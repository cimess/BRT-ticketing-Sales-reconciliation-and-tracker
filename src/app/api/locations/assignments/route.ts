// src/app/api/locations/assignments/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { Time_Session, Prisma } from "@prisma/client";

interface AssignmentInput {
  userId: string;
  locationId: string;
  session: string;
}

interface PostBodyInput {
  date?: string;
  forceReplace?: boolean;
  assignments?: AssignmentInput[];
}

// GET /api/locations/assignments
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role, company_id, id: currentUserId } = session.user;

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const scopeParam = searchParams.get("scope"); // "personal" | "team"
    const userIdParam = searchParams.get("userId");
    const locationIdParam = searchParams.get("locationId");

    // Resolve target scope
    const scope = scopeParam || (role === "TICKETER" ? "personal" : "team");
    const targetUserId = scope === "personal" ? currentUserId : (userIdParam || undefined);

    let gte: Date | undefined;
    let lte: Date | undefined;

    if (dateParam) {
      const targetDate = new Date(dateParam);
      gte = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
      lte = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));
    } else if (startDateParam && endDateParam) {
      const start = new Date(startDateParam);
      const end = new Date(endDateParam);
      gte = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0));
      lte = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59));
    } else {
      // Default: broad window (+/- 30 days) to see roster history
      const now = new Date();
      const past = new Date();
      past.setDate(now.getDate() - 30);
      const future = new Date();
      future.setDate(now.getDate() + 30);
      gte = new Date(Date.UTC(past.getUTCFullYear(), past.getUTCMonth(), past.getUTCDate(), 0, 0, 0));
      lte = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 23, 59, 59));
    }

    const where: Prisma.Ticketer_Location_AssignmentWhereInput = { company_id };
    if (gte && lte) {
      where.assigned_for = { gte, lte };
    }
    if (targetUserId) {
      where.user_id = targetUserId;
    }
    if (locationIdParam) {
      where.location_id = locationIdParam;
    }

    const assignments = await prisma.ticketer_Location_Assignment.findMany({
      where,
      include: {
        location: true,
        user: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        creator: {
          select: { first_name: true, last_name: true },
        }
      },
      orderBy: [
        { assigned_for: "asc" },
        { session: "asc" }
      ],
      take: 300,
    });

    const mappedData = assignments.map((la) => ({
      id: la.location.id,
      assignmentId: la.id,
      locationName: la.location.name,
      locationAddress: la.location.address,
      assignedFor: la.assigned_for.toISOString().split("T")[0],
      session: la.session,
      userId: la.user_id,
      ticketerName: `${la.user.first_name} ${la.user.last_name}`.trim(),
      ticketerEmail: la.user.email,
      createdByName: la.creator ? `${la.creator.first_name} ${la.creator.last_name}`.trim() : "System",
      createdById: la.created_by_id
    }));

    return NextResponse.json({
      success: true,
      data: mappedData,
    });
  } catch (error) {
    console.error("GET assignments error:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

// POST /api/locations/assignments
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPERVISOR" || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Supervisor access required." }, { status: 403 });
    }
    const { company_id, id: supervisorId } = session.user;
    const body = (await req.json()) as PostBodyInput;

    const { date, forceReplace, assignments } = body;

    if (!date) {
      return NextResponse.json({ error: "Assignment date is required." }, { status: 400 });
    }

    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);

    // 1. Past-Date Guard: Do not allow retroactive assignment changes
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (targetDate < today) {
      return NextResponse.json({ error: "Cannot schedule or modify assignments for past dates." }, { status: 400 });
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: "Assignments list is required." }, { status: 400 });
    }

    // 2. Conflict Checking (Two-Step Override Warning)
    const existingCount = await prisma.ticketer_Location_Assignment.count({
      where: { company_id, assigned_for: targetDate },
    });

    if (existingCount > 0 && !forceReplace) {
      return NextResponse.json({
        success: false,
        conflict: true,
        message: `Roster already scheduled for this date. Overwriting will replace all ${existingCount} active assignment(s).`
      }, { status: 409 });
    }

    // 3. Process Roster Creation inside strict atomic database transaction
    await prisma.$transaction(async (tx) => {
      if (forceReplace && existingCount > 0) {
        // Clear previous roster for this day
        await tx.ticketer_Location_Assignment.deleteMany({
          where: { company_id, assigned_for: targetDate },
        });
      }

      // Check capacity counts per location and session before inserting
      const locationSessionMap = new Map<string, number>();

      for (const item of assignments) {
        const { userId, locationId, session: sessionType } = item;
        if (!userId || !locationId || !sessionType) continue;

        // Group capacity checks locally to account for batch changes
        const key = `${locationId}_${sessionType}`;
        const scheduledCount = (locationSessionMap.get(key) || 0) + 1;
        locationSessionMap.set(key, scheduledCount);

        const location = await tx.location.findUnique({
          where: { id: locationId, company_id },
          select: { staff_count: true, name: true }
        });

        if (!location) {
          throw new ApiError(404, `Location not found.`);
        }

        // Validate local count + existing database values
        if (scheduledCount > location.staff_count) {
          throw new ApiError(400, `Capacity full: ${location.name} allows a maximum of ${location.staff_count} staff per session.`);
        }

        // Validate that this ticketer doesn't already have another assignment for this session
        const ticketerConflict = await tx.ticketer_Location_Assignment.findFirst({
          where: {
            company_id,
            user_id: userId,
            assigned_for: targetDate,
            session: sessionType as Time_Session
          }
        });

        if (ticketerConflict) {
          throw new ApiError(400, `Double assignment: Selected ticketer is already scheduled to work elsewhere during the ${sessionType} session.`);
        }

        // Create assignment
        const created = await tx.ticketer_Location_Assignment.create({
          data: {
            company_id,
            user_id: userId,
            location_id: locationId,
            session: sessionType as Time_Session,
            assigned_for: targetDate,
            created_by_id: supervisorId,
          },
        });

        // Audit Log Entry
        await tx.auditLog.create({
          data: {
            company_id,
            user_id: supervisorId,
            action: "CREATE",
            entity_type: "LOCATION_ASSIGNMENT",
            entity_id: created.id,
            after_state: JSON.parse(JSON.stringify(created)),
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Roster saved successfully for ${date}`,
    });
  } catch (error) {
    console.error("POST assignments error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to schedule roster" }, { status: 500 });
  }
}

// DELETE /api/locations/assignments
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPERVISOR" || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Supervisor access required." }, { status: 403 });
    }
    const { company_id, id: supervisorId } = session.user;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    // Past-Date Guard on Deletions
    const assignment = await prisma.ticketer_Location_Assignment.findUnique({
      where: { id, company_id }
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const assignmentDate = new Date(assignment.assigned_for);
    assignmentDate.setUTCHours(0,0,0,0);

    if (assignmentDate < today) {
      return NextResponse.json({ error: "Cannot delete or alter past roster assignments." }, { status: 400 });
    }

    const deletedAssignment = await prisma.ticketer_Location_Assignment.delete({
      where: { id, company_id },
    });

    await prisma.auditLog.create({
      data: {
        user_id: supervisorId,
        action: "DELETE",
        entity_type: "LOCATION_ASSIGNMENT",
        entity_id: id,
        before_state: JSON.parse(JSON.stringify(deletedAssignment)),
        company_id,
      },
    });

    return NextResponse.json({ success: true, message: "Assignment removed successfully" });
  } catch (error) {
    console.error("DELETE assignment error:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
