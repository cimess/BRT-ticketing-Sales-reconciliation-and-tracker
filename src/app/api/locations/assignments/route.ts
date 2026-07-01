// src/app/api/locations/assignments/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Define the shape for monthly frequency statistics to avoid 'any'
interface MonthlyStat {
  locationId: string;
  locationName: string;
  userId: string;
  userName: string;
  visitCount: number;
}

// GET /api/locations/assignments
// Query daily roster, range calendars, team locations, or monthly visit statistics
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
    const statsMonthParam = searchParams.get("statsMonth"); // e.g. "2026-06"

    // 1. Resolve Scope and Target User
    // Default to "personal" for ticketers unless they request to see their team/friends
    const scope = scopeParam || (role === "TICKETER" ? "personal" : "team");
    const targetUserId = scope === "personal" ? currentUserId : (userIdParam || undefined);

    // 2. Resolve Date Range
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
      // Default fallbacks if no range is requested
      if (scope === "personal" || targetUserId) {
        // Query broad window (+/- 30 days) to see past history and future upcoming dates
        const now = new Date();
        const past = new Date();
        past.setDate(now.getDate() - 30);
        const future = new Date();
        future.setDate(now.getDate() + 30);
        gte = new Date(Date.UTC(past.getUTCFullYear(), past.getUTCMonth(), past.getUTCDate(), 0, 0, 0));
        lte = new Date(Date.UTC(future.getUTCFullYear(), future.getUTCMonth(), future.getUTCDate(), 23, 59, 59));
      } else {
        // Default to today's active assignments roster
        const today = new Date();
        gte = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));
        lte = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
      }
    }

    // 3. Query Assignments with explicit TypeScript where clause types
    const where: {
      company_id: string;
      assigned_for?: { gte: Date; lte: Date };
      user_id?: string;
      location_id?: string;
    } = { company_id };

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
      },
      orderBy: { assigned_for: "asc" },
      take: 200, // Safe upper boundary
    });

    const mappedData = assignments.map((la) => ({
      id: la.location.id,
      assignmentId: la.id,
      locationName: la.location.name,
      locationAddress: la.location.address,
      assignedFor: la.assigned_for.toISOString().split("T")[0],
      userId: la.user_id,
      ticketerName: `${la.user.first_name} ${la.user.last_name}`.trim(),
      ticketerEmail: la.user.email,
    }));

    // 4. Frequency/Visit Count Analysis (Monthly statistics)
    let monthlyStats: MonthlyStat[] = [];
    if (statsMonthParam) {
      const [yearStr, monthStr] = statsMonthParam.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1; // JS month index is 0-11

      const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

      const statsWhere: {
        company_id: string;
        assigned_for: { gte: Date; lte: Date };
        user_id?: string;
      } = {
        company_id,
        assigned_for: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };

      if (targetUserId) {
        statsWhere.user_id = targetUserId;
      }

      // Group history by user and location for that month
      const grouped = await prisma.ticketer_Location_Assignment.groupBy({
        by: ["location_id", "user_id"],
        where: statsWhere,
        _count: {
          id: true,
        },
      });

      // Retrieve display details for the grouped entities
      const locations = await prisma.location.findMany({
        where: { company_id },
        select: { id: true, name: true },
      });
      const users = await prisma.user.findMany({
        where: { company_id },
        select: { id: true, first_name: true, last_name: true },
      });

      monthlyStats = grouped.map((g) => {
        const loc = locations.find((l) => l.id === g.location_id);
        const usr = users.find((u) => u.id === g.user_id);
        return {
          locationId: g.location_id,
          locationName: loc?.name || "Unknown Location",
          userId: g.user_id,
          userName: usr ? `${usr.first_name} ${usr.last_name}` : "Unknown User",
          visitCount: g._count.id,
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: mappedData,
      monthlyStats,
    });
  } catch (error) {
    console.error("GET assignments error:", error);
    return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
  }
}

// POST /api/locations/assignments
// Create single, range, or smart auto-rosters
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPERVISOR" || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Supervisor access required." }, { status: 403 });
    }
    const { company_id, id: supervisorId } = session.user;
    const body = await req.json();

    const { mode, userId, locationId, date, startDate, endDate } = body;

    // Resolve date targets
    const datesToAssign: Date[] = [];
    if (mode === "range") {
      if (!startDate || !endDate) {
        return NextResponse.json({ error: "Start date and End date are required for range generation" }, { status: 400 });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      const cursor = new Date(start);
      while (cursor <= end) {
        datesToAssign.push(new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const targetDateStr = date || startDate; // Fallback
      if (!targetDateStr) {
        return NextResponse.json({ error: "Assignment date is required" }, { status: 400 });
      }
      const singleDate = new Date(targetDateStr);
      datesToAssign.push(new Date(Date.UTC(singleDate.getFullYear(), singleDate.getMonth(), singleDate.getDate())));
    }

    if (datesToAssign.length === 0) {
      return NextResponse.json({ error: "No valid dates selected" }, { status: 400 });
    }

    // A. Mode: SMART AUTO-ASSIGNMENT (Fair rotation matching)
    if (mode === "auto") {
      await prisma.$transaction(async (tx) => {
        // Fetch all active, unrestricted ticketers
        const ticketers = await tx.user.findMany({
          where: { company_id, role: "TICKETER", restricted: false },
          select: { id: true, first_name: true, last_name: true },
        });

        // Fetch all physical terminal locations
        const locations = await tx.location.findMany({
          where: { company_id },
          select: { id: true, name: true },
        });

        for (const targetDate of datesToAssign) {
          // Query active roster for this day
          const existing = await tx.ticketer_Location_Assignment.findMany({
            where: { company_id, assigned_for: targetDate },
            select: { user_id: true, location_id: true },
          });

          const assignedTicketerIds = new Set(existing.map((e) => e.user_id));
          const assignedLocationIds = new Set(existing.map((e) => e.location_id));

          // Isolate unassigned pool
          const availableTicketers = ticketers.filter((t) => !assignedTicketerIds.has(t.id));
          const availableLocations = locations.filter((l) => !assignedLocationIds.has(l.id));

          if (availableTicketers.length === 0 || availableLocations.length === 0) {
            continue; // No spots to match
          }

          // Query the last 30 days of roster history to ensure fair placement distribution
          const thirtyDaysAgo = new Date(targetDate);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const history = await tx.ticketer_Location_Assignment.groupBy({
            by: ["user_id", "location_id"],
            where: {
              company_id,
              assigned_for: {
                gte: thirtyDaysAgo,
                lt: targetDate,
              },
            },
            _count: { id: true },
          });

          // Build a lookup map of [userId_locationId] -> timesVisited
          const historyMap = new Map<string, number>();
          for (const h of history) {
            historyMap.set(`${h.user_id}_${h.location_id}`, h._count.id);
          }

          const remainingTicketers = [...availableTicketers];

          for (const loc of availableLocations) {
            if (remainingTicketers.length === 0) break;

            // Sort unassigned ticketers by how many times they visited this specific location (ascending)
            remainingTicketers.sort((a, b) => {
              const countA = historyMap.get(`${a.id}_${loc.id}`) || 0;
              const countB = historyMap.get(`${b.id}_${loc.id}`) || 0;
              return countA - countB;
            });

            // Assign the ticketer with the lowest rotation count to this spot
            const selectedTicketer = remainingTicketers.shift()!;
            
            const created = await tx.ticketer_Location_Assignment.create({
              data: {
                company_id,
                user_id: selectedTicketer.id,
                location_id: loc.id,
                assigned_for: targetDate,
              },
            });

            // Add corresponding audit log
            await tx.auditLog.create({
              data: {
                user_id: supervisorId,
                action: "CREATE",
                entity_type: "LOCATION_ASSIGNMENT",
                entity_id: created.id,
                after_state: JSON.parse(JSON.stringify(created)),
                company_id,
              },
            });
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: `Roster auto-assigned successfully for ${datesToAssign.length} day(s)`,
      });
    }

        // B. Mode: BULK MAPPING (Assigning multiple locations to ticketers on specific date(s))
    if (mode === "bulk") {
      const { assignments } = body; // Array of { userId: string | null, locationId: string }
      if (!Array.isArray(assignments)) {
        return NextResponse.json({ error: "Assignments list is required for bulk mode" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        for (const targetDate of datesToAssign) {
          for (const item of assignments) {
            const { userId, locationId } = item;
            if (!locationId) continue;

            // If userId is truthy, set assignment. If falsy (empty or null), unassign/delete the location's mapping on this day.
            if (userId) {
              // Enforce 1-to-1 constraints: remove any existing conflicts on this targetDate
              await tx.ticketer_Location_Assignment.deleteMany({
                where: { company_id, user_id: userId, assigned_for: targetDate },
              });
              await tx.ticketer_Location_Assignment.deleteMany({
                where: { company_id, location_id: locationId, assigned_for: targetDate },
              });

              // Create assignment
              const createdAssignment = await tx.ticketer_Location_Assignment.create({
                data: {
                  company_id,
                  user_id: userId,
                  location_id: locationId,
                  assigned_for: targetDate,
                },
              });

              await tx.auditLog.create({
                data: {
                  user_id: supervisorId,
                  action: "CREATE",
                  entity_type: "LOCATION_ASSIGNMENT",
                  entity_id: createdAssignment.id,
                  after_state: JSON.parse(JSON.stringify(createdAssignment)),
                  company_id,
                },
              });
            } else {
              // Unassign this location for this targetDate
               const existing = await tx.ticketer_Location_Assignment.findMany({
                where: { company_id, user_id: userId, assigned_for: targetDate },
              });
              for (const old of existing) {
                await tx.ticketer_Location_Assignment.delete({
                  where: { id: old.id },
                });
                await tx.auditLog.create({
                  data: {
                    user_id: supervisorId,
                    action: "DELETE",
                    entity_type: "LOCATION_ASSIGNMENT",
                    entity_id: old.id,
                    before_state: JSON.parse(JSON.stringify(old)),
                    company_id,
                  },
                });
              }
            }
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: `Roster saved successfully for ${datesToAssign.length} day(s)`,
      });
    }

    // C. Mode: MANUAL RANGE (Single user to single location range assignment)
    if (!userId || !locationId) {
      return NextResponse.json({ error: "Ticketer and Location options are required" }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      for (const targetDate of datesToAssign) {
        // Enforce 1-to-1 relationships on target dates
        await tx.ticketer_Location_Assignment.deleteMany({
          where: { company_id, location_id: locationId, assigned_for: targetDate },
        });
        await tx.ticketer_Location_Assignment.deleteMany({
          where: { company_id, user_id: userId, assigned_for: targetDate },
        });
        const createdAssignment = await tx.ticketer_Location_Assignment.create({
          data: {
            company_id,
            user_id: userId,
            location_id: locationId,
            assigned_for: targetDate,
          },
        });
        await tx.auditLog.create({
          data: {
            user_id: supervisorId,
            action: "CREATE",
            entity_type: "LOCATION_ASSIGNMENT",
            entity_id: createdAssignment.id,
            after_state: JSON.parse(JSON.stringify(createdAssignment)),
            company_id,
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

// DELETE /api/locations/assignments
// Delete an assignment mapping (SUPERVISOR only)
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

    const deletedAssignment = await prisma.ticketer_Location_Assignment.delete({
      where: { id, company_id },
    });

    // Write audit log entry
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

    return NextResponse.json({ success: true, message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("DELETE assignment error:", error);
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
  }
}



// PATCH /api/locations/assignments
// Reassign or update an existing roster mapping (e.g. for sick leave/emergency swaps)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "SUPERVISOR" || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Supervisor access required." }, { status: 403 });
    }
    const { company_id, id: supervisorId } = session.user;
    const body = await req.json();
    const { assignmentId, userId, locationId } = body;

    if (!assignmentId) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    if (!userId && !locationId) {
      return NextResponse.json({ error: "At least one field to update (userId or locationId) is required" }, { status: 400 });
    }

    // Execute atomic database transactions to clear conflicts, update, and log changes
    const updatedAssignment = await prisma.$transaction(async (tx) => {
      // 1. Fetch current assignment to get target date and current configuration
      const current = await tx.ticketer_Location_Assignment.findUnique({
        where: { id: assignmentId, company_id },
      });

      if (!current) {
        throw new Error("Assignment not found");
      }

      const targetDate = current.assigned_for;
      const finalUserId = userId || current.user_id;
      const finalLocationId = locationId || current.location_id;

      // 2. Resolve conflicting assignments for the new ticketer on this day
      if (userId && userId !== current.user_id) {
        await tx.ticketer_Location_Assignment.deleteMany({
          where: {
            company_id,
            user_id: userId,
            assigned_for: targetDate,
            id: { not: assignmentId }, // Do not delete the current record itself
          },
        });
      }

      // 3. Resolve conflicting assignments for the new location on this day
      if (locationId && locationId !== current.location_id) {
        await tx.ticketer_Location_Assignment.deleteMany({
          where: {
            company_id,
            location_id: locationId,
            assigned_for: targetDate,
            id: { not: assignmentId },
          },
        });
      }

      // 4. Update the assignment
      const updated = await tx.ticketer_Location_Assignment.update({
        where: { id: assignmentId },
        data: {
          user_id: finalUserId,
          location_id: finalLocationId,
        },
      });

      // 5. Write audit log
      await tx.auditLog.create({
        data: {
          user_id: supervisorId,
          action: "UPDATE",
          entity_type: "LOCATION_ASSIGNMENT",
          entity_id: assignmentId,
          before_state: JSON.parse(JSON.stringify(current)),
          after_state: JSON.parse(JSON.stringify(updated)),
          company_id,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      message: "Assignment reassigned successfully",
      data: updatedAssignment,
    });
  } catch (error) {
    console.error("PATCH assignment error:", error);
    const msg = error instanceof Error ? error.message : "Failed to update assignment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
