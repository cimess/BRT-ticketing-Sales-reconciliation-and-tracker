import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/locations/assignments - Query daily roster or personal assignment calendar
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { role, company_id, id: userId } = session.user;

    // A. For Ticketers: Return their personal upcoming assignments schedule/roster
    if (role === "TICKETER") {
      const assignments = await prisma.ticketer_Location_Assignment.findMany({
        where: { user_id: userId, company_id },
        include: { location: true },
        orderBy: { assigned_for: "asc" },
      });

      const mapped = assignments.map((la) => ({
        id: la.location.id,
        assignmentId: la.id,
        locationName: la.location.name,
        locationAddress: la.location.address,
        assignedFor: la.assigned_for.toISOString().split("T")[0],
      }));

      return NextResponse.json({ success: true, data: mapped });
    }

    // B. For Admin & Supervisor: Fetch date-specific assignments list
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
    } else {
      // If no filter selected, query the date of the latest existing assignment
      const lastAssignment = await prisma.ticketer_Location_Assignment.findFirst({
        where: { company_id },
        orderBy: { assigned_for: "desc" },
        select: { assigned_for: true },
      });

      if (lastAssignment) {
        targetDate = lastAssignment.assigned_for;
      } else {
        targetDate = new Date();
      }
    }

    // Normalize targetDate to date-only range (Midnight to EOD UTC)
    const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
    const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));

    const assignments = await prisma.ticketer_Location_Assignment.findMany({
      where: {
        company_id,
        assigned_for: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        location: true,
        user: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
      },
      orderBy: { location: { name: "asc" } },
    });

    const mapped = assignments.map((la) => ({
      id: la.location.id,
      assignmentId: la.id,
      locationName: la.location.name,
      locationAddress: la.location.address,
      assignedFor: la.assigned_for.toISOString().split("T")[0],
      userId: la.user_id,
      ticketerName: `${la.user.first_name} ${la.user.last_name}`.trim(),
      ticketerEmail: la.user.email,
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      date: startOfDay.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("GET assignments error:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

// POST /api/locations/assignments - Map a ticketer to a location (SUPERVISOR only)
// Supports "single" day mapping or a full date "range" (e.g. for generating full month rosters)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Unauthorized. Supervisor access required." }, { status: 403 });
    }
    const { company_id } = session.user;
    const body = await req.json();

    const { mode, userId, locationId, date, startDate, endDate } = body;

    if (!userId || !locationId) {
      return NextResponse.json({ error: "Ticketer and Location options are required" }, { status: 400 });
    }

    const datesToAssign: Date[] = [];

    if (mode === "range") {
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "Start date and End date are required for roster generation" }, { status: 400 });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);

      const cursor = new Date(start);
      while (cursor <= end) {
        datesToAssign.push(new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      if (!date) {
        return NextResponse.json({ error: "Assignment date is required" }, { status: 400 });
      }
      const singleDate = new Date(date);
      datesToAssign.push(new Date(Date.UTC(singleDate.getFullYear(), singleDate.getMonth(), singleDate.getDate())));
    }

    if (datesToAssign.length === 0) {
      return NextResponse.json({ error: "No valid dates inside the selected range" }, { status: 400 });
    }

    // Execute safe database transaction to clean up duplicates and create assignments
    await prisma.$transaction(async (tx) => {
      for (const targetDate of datesToAssign) {
        // Remove duplicate assignment for the exact location on this day (location can only have one ticketer)
        await tx.ticketer_Location_Assignment.deleteMany({
          where: {
            company_id,
            location_id: locationId,
            assigned_for: targetDate,
          },
        });

        // Remove duplicate assignment for the exact ticketer on this day (ticketer can only be at one location)
        await tx.ticketer_Location_Assignment.deleteMany({
          where: {
            company_id,
            user_id: userId,
            assigned_for: targetDate,
          },
        });

        // Insert new assignment
        await tx.ticketer_Location_Assignment.create({
          data: {
            company_id,
            user_id: userId,
            location_id: locationId,
            assigned_for: targetDate,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully scheduled roster assignments for ${datesToAssign.length} days`,
    });
  } catch (error) {
    console.error("POST assignments error:", error);
    return NextResponse.json({ error: "Failed to save location assignment roster" }, { status: 500 });
  }
}

// DELETE /api/locations/assignments - Delete an assignment mapping (SUPERVISOR only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Unauthorized. Supervisor access required." }, { status: 403 });
    }
    const { company_id } = session.user;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    await prisma.ticketer_Location_Assignment.delete({
      where: { id, company_id },
    });

    return NextResponse.json({ success: true, message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("DELETE assignment error:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}
