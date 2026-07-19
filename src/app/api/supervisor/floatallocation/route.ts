// src/app/api/supervisor/topup/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/ApiError";
import { sendNotification } from "@/app/server/services/notification.service";


export async function GET(req: NextRequest) { // Updated signature
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // 1. Fetch active sessions for dropdown selection
    const activeSessions = await prisma.posDeviceSession.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } },
        device: { select: { name: true } }
      }
    });

    // Construct the date range filtering where object
    const whereClause: Prisma.Float_allocationsWhereInput = {};
    if (fromDate || toDate) {
      whereClause.allocated_at = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }

    // 2. Fetch history of POS float allocations filtered by date
    const history = await prisma.float_allocations.findMany({
      where: { company_id, ...whereClause }, // Apply the date filters here
      orderBy: {
        allocated_at: "desc"
      },
      include: {
        supervisor: {
          select: {
            first_name: true,
            last_name: true,
            role: true
          }
        },
        pos_device: {
          include: {
            user: { select: { first_name: true, last_name: true } },
            device: { select: { name: true } }
          }
        }
      }
    });
    // Fetch all related ledger entries to calculate pre-allocation balances dynamically
    const sessionIds = Array.from(new Set(history.map((h: { pos_device_id: string }) => h.pos_device_id)));
    const ledgers = await prisma.float_Ledger.findMany({
      where: {
        account_id: { in: sessionIds },
        account_type: "POS_DEVICE",
        company_id,
      },
      orderBy: {
        created_at: "asc",
      },
    });

    const preAllocationBalances: Record<string, number> = {};
    const sessionRunningBalances: Record<string, number> = {};

    for (const entry of ledgers) {
      const sessionId = entry.account_id;
      const currentBal = sessionRunningBalances[sessionId] || 0;

      if (entry.reference_type === "ALLOCATION") {
        // Record the balance of the session BEFORE this allocation was added
        preAllocationBalances[entry.reference_id] = currentBal;
      }

      const amount = Number(entry.amount);
      if (entry.entry_type === "CREDIT") {
        sessionRunningBalances[sessionId] = currentBal + amount;
      } else {
        sessionRunningBalances[sessionId] = currentBal - amount;
      }
    }


    return NextResponse.json({
      success: true,
      sessions: activeSessions.map((s: {
        id: string;
        device: {
          name: string;
        };
        user: {
          id: string;
          first_name: string;
          last_name: string;
        };
        pos_float: number | object;
      }) => ({
        id: s.id,
        deviceName: s.device.name,
        ticketerId: s.user.id,
        ticketerName: `${s.user.first_name || ""} ${s.user.last_name || ""}`.trim(),
        currentFloat: Number(s.pos_float)
      })),
      history: history.map((h: {
        id: string;
        supervisor: {
          first_name: string;
          last_name: string;
          role: string;
        };
        pos_device: {
          user: {
            first_name: string;
            last_name: string;
          };
          device: {
            name: string;
          };
        };
        amount_allocated: number | object;
        status: string;
        allocated_at: Date;
      }) => ({
        id: h.id,
        top_up_id: h.id,
        from_user: `${h.supervisor.first_name || ""} ${h.supervisor.last_name || ""}`.trim(),
        from_role: h.supervisor.role,
        to_user: `${h.pos_device.user.first_name || ""} ${h.pos_device.user.last_name || ""} (${h.pos_device.device.name || "Unknown"})`.trim(),
        to_role: "TICKETER",
        amount_allocated: Number(h.amount_allocated),
        amount_remaining: Number(h.amount_allocated),
        status: h.status,
        allocated_at: h.allocated_at.toISOString(),
        pre_allocation_float: preAllocationBalances[h.id] ?? 0
      }))
    });
  } catch (error) {
    console.error("GET /api/supervisor/topup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


// POST endpoint code remains exactly the same...


// src/app/api/supervisor/floatallocation/route.ts
// Replace POST method with this implementation:

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;
    const { posSessionId, deviceId, amount } = await req.json();

    if ((!posSessionId && !deviceId) || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const allocationAmount = new Prisma.Decimal(amount);
    let targetUserId = "";
    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and verify TopUp Bank
      const topUpBank = await tx.topUpBank.findUnique({
        where: { id: "TOPUP_BANK", company_id }
      });

      if (!topUpBank || topUpBank.available_balance.lt(allocationAmount)) {
        throw new ApiError(400, "Insufficient operational float available in TopUp Bank. Please request Admin to top up.");
      }


      let activeSessionId = posSessionId;
       targetUserId = "";

      if (deviceId) {
        const device = await tx.pos_devices.findUnique({
          where: { id: deviceId, company_id }
        });

        if (!device) {
          throw new ApiError(404, "POS device not found");
        }

        if (device.status === "MAINTENANCE") {
          throw new ApiError(400, "Cannot allocate to a device in maintenance");
        }

        const lastSession = await tx.posDeviceSession.findFirst({
          where: { device_id: deviceId, company_id },
          orderBy: { assigned_at: "desc" },
          include: { user: true }
        });

        if (!lastSession) {
          throw new ApiError(400, "Device has no assignment history. Assign manually first.");
        }

        const isSupervisorOwned =
          session.user.role === "ADMIN" ||
          lastSession.user.supervisor_id === session.user.id ||
          lastSession.assigned_by === session.user.id;

        if (!isSupervisorOwned) {
          throw new ApiError(403, "You can only manage devices for ticketers under your supervision.");
        }

        if (device.status === "ACTIVE") {
          if (lastSession.status !== "ACTIVE") {
            throw new ApiError(400, "Device status is Active but session is not. Contact Admin.");
          }
          activeSessionId = lastSession.id;
          targetUserId = lastSession.user_id;
        } else {
          // Device is INACTIVE. Perform Quick Assignment
          const user = lastSession.user;

          if (user.role !== "TICKETER") {
            throw new ApiError(400, `Last holder (${user.first_name} ${user.last_name}) is no longer a Ticketer.`);
          }

          if (user.restricted) {
            throw new ApiError(400, `Last holder (${user.first_name} ${user.last_name}) account is restricted.`);
          }

          const userActiveSession = await tx.posDeviceSession.findFirst({
            where: { user_id: user.id, status: "ACTIVE", company_id }
          });
          if (userActiveSession) {
            throw new ApiError(400, `${user.first_name} ${user.last_name} is already active on device: ${userActiveSession.device_id}`);
          }

          const pendingSales = await tx.salesReport.findFirst({
            where: { pos_session_id: lastSession.id, status: "PENDING", company_id }
          });
          if (pendingSales) {
            throw new ApiError(400, `Cannot assign: ${user.first_name} ${user.last_name} has a pending sales report.`);
          }

          const pendingRemit = await tx.remittance.findFirst({
            where: { pos_session_id: lastSession.id, status: "PENDING", company_id }
          });
          if (pendingRemit) {
            throw new ApiError(400, `Cannot assign: ${user.first_name} ${user.last_name} has pending remittances.`);
          }

          const carriedOverFloat = lastSession.pos_float;

          // Create assignment session with the carried over float
          const newSession = await tx.posDeviceSession.create({
            data: {
              company_id,
              device_id: deviceId,
              user_id: user.id,
              pos_float: carriedOverFloat,
              assigned_by: session.user.id!,
              status: "ACTIVE",
            },
          });

          // 💡 1. Decrement carried-over float from previous session's expectation (avoid double charging)
          if (lastSession && new Prisma.Decimal(carriedOverFloat).gt(0)) {
            const lastExpectation = await tx.remittanceExpectation.findUnique({
              where: { pos_session_id: lastSession.id }
            });
            if (lastExpectation) {
              const updatedExpected = Math.max(0, Number(lastExpectation.expected_amount) - Number(carriedOverFloat));
              const updatedShortage = Math.max(0, Number(lastExpectation.shortage_amount) - Number(carriedOverFloat));
              await tx.remittanceExpectation.update({
                where: { id: lastExpectation.id },
                data: {
                  expected_amount: updatedExpected,
                  shortage_amount: updatedShortage,
                  status: updatedShortage <= 0 ? "PAID" : lastExpectation.status
                }
              });
            }
          }

          // 💡 2. Initialize the new session's expectation with the carried-over opening float
          if (new Prisma.Decimal(carriedOverFloat).gt(0)) {
            await tx.remittanceExpectation.create({
              data: {
                company_id,
                user_id: user.id,
                pos_session_id: newSession.id,
                expected_amount: Number(carriedOverFloat),
                shortage_amount: Number(carriedOverFloat),
                due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
                status: "PENDING",
              }
            });
          }


          // Update device status to ACTIVE
          await tx.pos_devices.update({
            where: { id: deviceId, company_id },
            data: { status: "ACTIVE" },
          });

          // Set ticketer's supervisor to current supervisor
          if (session.user.role === "SUPERVISOR") {
            await tx.user.update({
              where: { id: user.id, company_id },
              data: { supervisor_id: session.user.id! },
            });
          }

          // Log the carried-over opening balance to the POS ledger
          if (carriedOverFloat.gt(0)) {
            await tx.float_Ledger.create({
              data: {
                company_id,
                account_id: newSession.id,
                account_type: "POS_DEVICE",
                posSession: newSession.id,
                amount: carriedOverFloat,
                entry_type: "CREDIT",
                reference_type: "SESSION_OPENING",
                reference_id: newSession.id,
                description: `Opening float balance carried over from previous session`,
              },
            });
          }

          // Audit log for quick assignment action
          await tx.auditLog.create({
            data: {
              company_id,
              user_id: session.user.id!,
              action: "CREATE",
              entity_type: "POS_DEVICE",
              entity_id: newSession.id,
              after_state: newSession,
            }
          });

          activeSessionId = newSession.id;
          targetUserId = user.id;
        }
      } else {
        const posSession = await tx.posDeviceSession.findUnique({
          where: { id: posSessionId, company_id }
        });

        if (!posSession || posSession.status !== "ACTIVE") {
          throw new ApiError(400, "Target POS session is not active or does not exist.");
        }
        targetUserId = posSession.user_id;
      }

      // 2. Decrement TopUp Bank
      const updatedTopUpBank = await tx.topUpBank.update({
        where: { id: "TOPUP_BANK", company_id },
        data: {
          available_balance: {
            decrement: allocationAmount
          }
        }
      });


      // 3. Increment POS session float
      await tx.posDeviceSession.update({
        where: { id: activeSessionId, company_id },
        data: {
          pos_float: {
            increment: allocationAmount
          }
        }
      });

      // 4. Create Float Allocation record
      const allocation = await tx.float_allocations.create({
        data: {
          company_id,
          from_user: session.user.id!,
          pos_device_id: activeSessionId,
          amount_allocated: allocationAmount,
          status: "SUCCESS"
        }
      });

      // 5. Create or Update the single Remittance Expectation for this POS Session
      const existingExpectation = await tx.remittanceExpectation.findUnique({
        where: { pos_session_id: activeSessionId }
      });

      if (!existingExpectation) {
        await tx.remittanceExpectation.create({
          data: {
            company_id,
            user_id: targetUserId,
            pos_session_id: activeSessionId,
            expected_amount: Number(allocationAmount),
            shortage_amount: Number(allocationAmount),
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "PENDING",
          }
        });
      } else {
        await tx.remittanceExpectation.update({
          where: { id: existingExpectation.id },
          data: {
            expected_amount: { increment: Number(allocationAmount) },
            shortage_amount: { increment: Number(allocationAmount) }
          }
        });
      }

      // 6. Create Debit entry in TopUp Bank Ledger
      await tx.float_Ledger.create({
        data: {
          company_id,
          account_id: "TOPUP_BANK",
          account_type: "TOPUP_BANK",
          amount: allocationAmount,
          entry_type: "DEBIT",
          reference_type: "ALLOCATION",
          reference_id: allocation.id,
          description: `Float allocated to POS session ${activeSessionId} by Supervisor`
        }
      });


      // 7. Create Credit entry in POS Ledger
      await tx.float_Ledger.create({
        data: {
          company_id,
          account_id: activeSessionId,
          account_type: "POS_DEVICE",
          posSession: activeSessionId,
          amount: allocationAmount,
          entry_type: "CREDIT",
          reference_type: "ALLOCATION",
          reference_id: allocation.id,
          description: `Float received from Supervisor`
        }
      });

      return {
        allocation,
        availableCompanyBalance: Number(updatedTopUpBank.available_balance)
      };

    });

    await sendNotification({
      companyId: company_id,
      message: `Float top-up of ₦${Number(amount).toLocaleString()} has been allocated to your POS device.`,
      type: "TOPUP_CREATED",
      referenceId: result.allocation.id,
      target: {
        userIds: [targetUserId].filter(Boolean),
        roles: ["ADMIN"],
        excludeUserId: session.user.id!,
      }
    });

    return NextResponse.json({
      success: true,
      message: "Float allocated successfully",
      data: result
    });
  } catch (error) {
    console.error("POST /api/supervisor/floatallocation error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, message: error.statusCode === 500 ? "Internal Server Error" : error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

