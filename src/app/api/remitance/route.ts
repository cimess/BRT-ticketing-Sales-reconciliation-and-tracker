// src/app/api/remitance/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const role = session.user.role;
    const company_id = session.user.company_id;
       // 🔒 1. Strict Role Guard: Only Ticketers can submit remittances
    if (role !== "TICKETER") {
      return NextResponse.json({ 
        error: "Unauthorized. Only ticketers can submit remittances for active POS sessions." 
      }, { status: 403 });
    }

    const body = await req.json();
    const ip = req.headers.get('x-forwarded-for') || "Unknown";
    const { amount, method, payment_reference, remittance_date, supervisor_id, pos_id } = body;

    const remittanceAmount = Number(amount);
    if (isNaN(remittanceAmount) || remittanceAmount <= 10 || !method || !remittance_date) {
      return NextResponse.json({ 
        error: isNaN(remittanceAmount) || remittanceAmount <= 10 ? "Invalid amount" : "Missing required fields",
        message: remittanceAmount > 0 ? "Missing required fields" : "Invalid amount" 
      }, { status: 400 });
    }

    const targetUserId = userId; 
    let receivedBySupId = null;

    // 💡 If Cash, track assigned supervisor
    if (method === "CASH" && supervisor_id) {
      receivedBySupId = supervisor_id;
    }

    let activeSessionId: string | null = null;

    const remitance = await prisma.$transaction(async (tx) => {
      // Find active session for ticketer
      let resolvedPosId = pos_id;
      if (!resolvedPosId) {
        const activeSession = await tx.posDeviceSession.findFirst({
          where: { user_id: targetUserId, status: "ACTIVE", company_id }
        });
        if (activeSession) {
          resolvedPosId = activeSession.id;
        }
      }

      if (resolvedPosId) {
        activeSessionId = resolvedPosId;
      }

      if (!activeSessionId) {
        throw new Error("No active POS device session found.");
      }

      // 1. TICKETER EXPECTATION & CUMULATIVE SUBMISSION GUARD
      let expectationToUpdate = null;
      if (activeSessionId) {
        const expectation = await tx.remittanceExpectation.findUnique({
          where: { pos_session_id: activeSessionId, company_id }
        });

        if (expectation) {
          if (expectation.status === "PAID") {
            throw new Error("The expectation for this POS session has already been fully paid.");
          }

          // Sum ALL in-flight remittances for this active session
          const existingPendingRemittances = await tx.remittance.aggregate({
            where: {
              company_id,
              pos_session_id: activeSessionId,
              status: { in: ["PENDING", "PENDING_SUPERVISOR_ACCEPTANCE", "ACCEPTED_BY_SUPERVISOR", "DEPOSITED"] }
            },
            _sum: { amount: true }
          });
          const totalPendingSubmitted = Number(existingPendingRemittances._sum.amount ?? 0);
          const remainingExpectation = expectation.shortage_amount - totalPendingSubmitted;

          if (remittanceAmount > remainingExpectation) {
            throw new Error(
              `Remittance amount (${remittanceAmount}) exceeds the remaining expectation (${remainingExpectation}) for this session (Expected Remaining: ${expectation.shortage_amount}, Already Submitted: ${totalPendingSubmitted}).`
            );
          }

          expectationToUpdate = expectation;
        }
      }


         // 3. CREATE REMITTANCE RECORD

         const initialStatus = (method === "CASH" && receivedBySupId)
        ? "PENDING_SUPERVISOR_ACCEPTANCE"
        : "PENDING";

      const newRemittance = await tx.remittance.create({
        data: {
          company_id,
          submitted_by: targetUserId,
          received_by_supervisor_id: receivedBySupId,
          amount: remittanceAmount,
          method: method,
          payment_reference: payment_reference || null,
          remittance_date: new Date(remittance_date),
          status: initialStatus,
          pos_session_id: activeSessionId
        }
      });


      // 4. UPDATE EXPECTATION STATUS
      if (expectationToUpdate) {
        const now = new Date();
        const restoredStatus = expectationToUpdate.due_date < now ? "OVERDUE" : "SUBMITTED";
        await tx.remittanceExpectation.update({
          where: { id: expectationToUpdate.id },
          data: { status: restoredStatus }
        });
      }

      // 5. AUDIT LOGGING
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: userId,
          action: "CREATE",
          entity_type: "REMITTANCE",
          entity_id: newRemittance.id,
          after_state: newRemittance,
          meta: {
            ip,
            posSession: pos_id || null,
          }
        }
      });

      return newRemittance;
    });

    return NextResponse.json({ success: true, data: remitance });
  } catch (error) {
    console.error("POST /api/remittance error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, message: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}



export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id: userId, role,company_id } = session.user;

    // 1️⃣ Parse optional date and pagination query params
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 20;
    const skip = (page - 1) * limit;

    // 2️⃣ Build date filter
    let dateFilter: Record<string, unknown> = {};

    if (fromParam && toParam) {
      // User explicitly selected a date range
      dateFilter = {
        remittance_date: {
          gte: new Date(fromParam),
          lte: new Date(toParam),
        }
      };
    } else {
      // DEFAULT: Today (start of day → end of day in user's timezone)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      dateFilter = {
        remittance_date: {
          gte: todayStart,
          lte: todayEnd,
        }
      };
    }
    
    // 3️⃣ Build role-based WHERE clause
    let roleFilter: Record<string, unknown> = {};
    if (role === "TICKETER") {
      roleFilter = { submitted_by: userId };
    } else if (role === "SUPERVISOR") {
      const ticketers = await prisma.user.findMany({ 
        where: { supervisor_id: userId,company_id }, 
        select: { id: true } 
      });
      const ids = ticketers.map(t => t.id);
      ids.push(userId); 
      roleFilter = { submitted_by: { in: ids } };
    }
    // ADMIN sees all — no roleFilter needed

    // 4️⃣ Combine filters
    const where = { ...roleFilter, ...dateFilter };

    // 5️⃣ Count total matching records for pagination metadata
    const total = await prisma.remittance.count({ where });

    // 6️⃣ Query database with pagination (skip/take)

       const remittances = await prisma.remittance.findMany({
      where:{...where,company_id},
      orderBy: { created_at: "desc" },
      skip,
      take: limit,
      include: {
        ticketer: { select: { first_name: true, last_name: true } },
        supervisor_receiver: { select: { first_name: true, last_name: true } },
        pos_session: { 
          select: { 
            id: true,
            device: { select: { name: true } } ,
            remittance_expectation: {
              select: { status: true }
            }
          } 
        }
      }
    });


    // 7️⃣ Fetch total outstanding expectations for the active role view

    let outstandingFilter = {};
    if (role === "TICKETER") {
      outstandingFilter = { user_id: userId };
    } else if (role === "SUPERVISOR") {
      const ticketers = await prisma.user.findMany({ 
        where: { supervisor_id: userId,company_id }, 
        select: { id: true } 
      });
      const ids = ticketers.map(t => t.id);
      outstandingFilter = { user_id: { in: ids } };
    } else {
      outstandingFilter = { user: { role: "TICKETER" } };
    }
       const outstandingExpectationAgg = await prisma.remittanceExpectation.aggregate({
      where: {
        ...outstandingFilter,
        company_id,
        status: { in: ["PENDING", "OVERDUE","VIOLATED","SUBMITTED"] }
      },
      _sum: { shortage_amount: true }
    });
    const totalOutstanding = Number(outstandingExpectationAgg._sum.shortage_amount ?? 0);
    // 8️⃣ Fetch current outstanding expectations for each user who has a remittance in this list
    const uniqueUserIds = Array.from(new Set(remittances.map(r => r.submitted_by)));
    const userExpectations = await prisma.remittanceExpectation.groupBy({
      by: ['user_id'],
      where: {
        company_id,
        user_id: { in: uniqueUserIds },
        status: { in: ["PENDING", "OVERDUE","VIOLATED","SUBMITTED"] }
      },
      _sum: { shortage_amount: true }
    });
    const outstandingMap = new Map<string, number>();
    for (const exp of userExpectations) {
      outstandingMap.set(exp.user_id, Number(exp._sum.shortage_amount ?? 0));
    }


// 9️⃣ Map and include ticketer_outstanding
    const mapped = remittances.map(r => ({
      id: r.id,
      amount: Number(r.amount),
      method: r.method,
      status: r.status,
      payment_reference: r.payment_reference,
      received_by_supervisor: r.supervisor_receiver 
        ? `${r.supervisor_receiver.first_name} ${r.supervisor_receiver.last_name}` 
        : null,
      remittance_date: r.remittance_date.toISOString(),
      created_at: r.created_at.toISOString(),
      submitted_by: `${r.ticketer.first_name} ${r.ticketer.last_name}`,
      verified_at: r.verified_at ? r.verified_at.toISOString() : null,
      pos_id: r.pos_session?.id || null,
      pos_name: r.pos_session?.device?.name || null,

      ticketer_outstanding: outstandingMap.get(r.submitted_by) || 0,
      is_reconciliation: ["OVERDUE", "VIOLATED"].includes(r.pos_session?.remittance_expectation?.status || ""),
    }));
    return NextResponse.json({ 
      success: true, 
      data: mapped,
      totalOutstanding,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("GET /api/remittance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

