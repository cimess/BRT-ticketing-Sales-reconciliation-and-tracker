// src/app/api/transaction/route.ts

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId, company_id } = session.user;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const type = searchParams.get("type"); // CREDIT, DEBIT, or ALL

    const where: Prisma.Float_LedgerWhereInput = {
      // Exclude internal system entries that are not actual financial transactions
      reference_type: { notIn: ["SESSION_OPENING", "TOP_UP", "TOP_UP_CANCEL", "TOP_UP_DELETION"] }
    };

    // 1. Role-based scoping
    if (role === "TICKETER") {
      const userSessions = await prisma.posDeviceSession.findMany({
        where: { user_id: userId, company_id },
        select: { id: true }
      });
      const sessionIds = userSessions.map(s => s.id);
      
      // Let ticketers see sessions assigned to them AND any ledger entries tied to their user account (remittances, fines)
      where.OR = [
        { posSession: { in: sessionIds } },
        { account_id: userId }
      ];

    } else if (role === "SUPERVISOR") {
      const teamTicketers = await prisma.user.findMany({
        where: { supervisor_id: userId, company_id },
        select: { id: true }
      });
      const teamUserIds = teamTicketers.map(t => t.id);

      const teamSessions = await prisma.posDeviceSession.findMany({
        where: { user_id: { in: teamUserIds }, company_id },
        select: { id: true }
      });
      const sessionIds = teamSessions.map(s => s.id);

      const supervisorAllocations = await prisma.float_allocations.findMany({
        where: { from_user: userId, company_id },
        select: { id: true }
      });
      const allocationIds = supervisorAllocations.map(a => a.id);

      // Let supervisors see team sessions, team user accounts, their own supervisor account, and their float allocations
      where.OR = [
        { posSession: { in: sessionIds } },
        { account_id: { in: [...teamUserIds, userId] } },
        { 
          account_type: "COMPANY", 
          reference_type: "ALLOCATION", 
          reference_id: { in: allocationIds } 
        }
      ];
    }


    // 2. Date Filtering
    if (fromDate || toDate) {
      where.created_at = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }
    // 3. Entry Type Filtering
    if (type && type !== "ALL") {
      where.entry_type = type as "CREDIT" | "DEBIT";
    }

    // 4. Single-side transaction view for non-auditors (deduplicates double entries)
   if (role !== "AUDITOR" && role !== "ADMIN") {
       where.account_type = { not: "COMPANY" };
     }

    // Fetch ledger logs
    const entries = await prisma.float_Ledger.findMany({
      where:{...where,company_id},
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        posDevice: {
          include: {
            user: { select: { first_name: true, last_name: true } },
            device: { select: { name: true } }
          }
        }
      }
    });

    // Resolve user display names for non-device accounts (e.g. remittances, fines)
    const userIds = entries
      .filter((e: { account_type: string }) => e.account_type === "TICKETER" || e.account_type === "SUPERVISOR")
      .map(e => e.account_id);

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, first_name: true, last_name: true }
    });

    const userMap = new Map(users.map(u => [u.id, `${u.first_name || ""} ${u.last_name || ""}`.trim()]));

    const mappedEntries = entries.map(e => {
      let user = "Company";
      if (e.account_type === "POS_DEVICE" && e.posDevice?.user) {
        user = `${e.posDevice.user.first_name || ""} ${e.posDevice.user.last_name || ""}`.trim();
        if (e.posDevice.device?.name) {
          user += ` (${e.posDevice.device.name})`;
        }
      } else if (e.account_type === "TICKETER" || e.account_type === "SUPERVISOR") {
        user = userMap.get(e.account_id) || "User";
      }

      // Determine display status (Credit, Debit, or Reversed)
      const isReversal = 
        e.reference_type === "ALLOCATION_CANCEL" || 
        e.reference_type === "FINE_PAYMENT_REVERSAL" || 
         e.reference_type === "COMPANY_ADJUSTMENT_REVERSAL" ||
        (e.reference_type === "REMITTANCE" && e.entry_type === "DEBIT") ||
        (e.description || "").toLowerCase().includes("reversal");

      // Dynamically compute the displayed entry type based on viewer's role
      let display_type: "CREDIT" | "DEBIT" = e.entry_type;

      if (role === "ADMIN" || role === "AUDITOR") {
        // Company perspective
        if (e.reference_type === "ALLOCATION") {
          display_type = "DEBIT"; // Float leaving the company vault
        } else if (e.reference_type === "ALLOCATION_CANCEL") {
          display_type = "CREDIT"; // Float returning to the company vault
        } else if (e.reference_type === "REMITTANCE") {
          display_type = isReversal ? "DEBIT" : "CREDIT"; // Verified deposits are CREDITs to company float
        } else if (e.reference_type === "FINE_PAYMENT") {
          display_type = "CREDIT"; // Fine payments received are CREDITs
        } else if (e.reference_type === "FINE_PAYMENT_REVERSAL") {
          display_type = "DEBIT"; // Reversed fine payments are DEBITs
        }
         } else if (e.reference_type === "COMPANY_DEPOSIT") {
          display_type = "CREDIT";
        } else if (e.reference_type === "COMPANY_WITHDRAWAL" || e.reference_type === "COMPANY_EXPENSE") {
          display_type = "DEBIT";
        } else if (e.reference_type === "COMPANY_ADJUSTMENT_REVERSAL") {
          display_type = e.entry_type;
      } else if (role === "TICKETER") {
        // Ticketer perspective
        if (e.reference_type === "ALLOCATION") {
          display_type = "CREDIT"; // Float received into POS session
        } else if (e.reference_type === "ALLOCATION_CANCEL") {
          display_type = "DEBIT"; // Float removed/reversed from session
        } else if (e.reference_type === "REMITTANCE") {
          display_type = isReversal ? "CREDIT" : "DEBIT"; // Paying remittance is a DEBIT from their perspective
        } else if (e.reference_type === "FINE_PAYMENT") {
          display_type = "DEBIT"; // Paying fine is a DEBIT
        } else if (e.reference_type === "FINE_PAYMENT_REVERSAL") {
          display_type = "CREDIT"; // Reversed fine is a CREDIT
        }
      } else if (role === "SUPERVISOR") {
        // Supervisor perspective
        if (e.reference_type === "ALLOCATION") {
          display_type = "DEBIT"; // Allocating float to ticketers is a DEBIT (leaving their hands)
        } else if (e.reference_type === "ALLOCATION_CANCEL") {
          display_type = "CREDIT"; // Reversed allocation is a CREDIT
        } else if (e.reference_type === "REMITTANCE") {
          if (e.account_type === "SUPERVISOR") {
            display_type = isReversal ? "CREDIT" : "DEBIT"; // Depositing team money to company bank is a DEBIT
          } else {
            display_type = isReversal ? "DEBIT" : "CREDIT"; // Receiving remittance from ticketers is a CREDIT
          }
        } else if (e.reference_type === "FINE_PAYMENT") {
          if (e.account_type === "SUPERVISOR") {
            display_type = "DEBIT";
          } else {
            display_type = "CREDIT";
          }
        } else if (e.reference_type === "FINE_PAYMENT_REVERSAL") {
          if (e.account_type === "SUPERVISOR") {
            display_type = "CREDIT";
          } else {
            display_type = "DEBIT";
          }
        }
      }

      const display_status = isReversal ? "REVERSED" : display_type;

      return {
        id: e.id,
        user,
        amount: Number(e.amount),
        entry_type: display_type,
        display_status,
        description: e.description || "",
        reference_type: e.reference_type,
        reference_id: e.reference_id,
        created_at: e.created_at.toISOString()
      };
    });




    // Time window for today's volume metrics
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let roleMetrics= {};

    if (role === "ADMIN" || role === "AUDITOR") {
      // Get all-time company ledger entries to audit balance
      const ledgerSummary = await prisma.float_Ledger.groupBy({
        by: ['entry_type'],
        where: { account_type: 'COMPANY',company_id },
        _sum: { amount: true }
      });

      let totalCredits = 0;
      let totalDebits = 0;
      for (const group of ledgerSummary) {
        if (group.entry_type === 'CREDIT') totalCredits = Number(group._sum.amount ?? 0);
        if (group.entry_type === 'DEBIT') totalDebits = Number(group._sum.amount ?? 0);
      }

      const ledgerNet = totalCredits - totalDebits;

      const companyFloat = await prisma.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT",company_id }
      });
      const actualBalance = companyFloat ? Number(companyFloat.available_balance) : 0;
      const drift = actualBalance - ledgerNet;

      // Given Today vs Returned Today
      const allocationsToday = await prisma.float_allocations.aggregate({
        where: {
          allocated_at: { gte: todayStart, lte: todayEnd },
          status: 'SUCCESS',company_id
        },
        _sum: { amount_allocated: true }
      });

      const remittancesToday = await prisma.remittance.aggregate({
        where: {
          created_at: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED',company_id
        },
        _sum: { amount: true }
      });

      roleMetrics = {
        credits: totalCredits,
        debits: totalDebits,
        ledgerNet,
        actualBalance,
        drift,
        givenToday: Number(allocationsToday._sum.amount_allocated ?? 0),
        returnedToday: Number(remittancesToday._sum.amount ?? 0)
      };

    } else if (role === "SUPERVISOR") {
      const ticketers = await prisma.user.findMany({
        where: { supervisor_id: userId,company_id },
        select: { id: true }
      });
      const ticketerIds = ticketers.map(t => t.id);

      // Given today
      const allocationsToday = await prisma.float_allocations.aggregate({
        where: {
          from_user: userId,
          allocated_at: { gte: todayStart, lte: todayEnd },
          status: 'SUCCESS',company_id
        },
        _sum: { amount_allocated: true }
      });

      // Returned today
      const remittancesToday = await prisma.remittance.aggregate({
        where: {
          submitted_by: { in: ticketerIds },
          created_at: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED',company_id
        },
        _sum: { amount: true }
      });

      const totalAllocations = await prisma.float_allocations.aggregate({
        where: {
          from_user: userId,
          status: 'SUCCESS',company_id
        },
        _sum: { amount_allocated: true }
      });

      const givenT = Number(allocationsToday._sum.amount_allocated ?? 0);
      const returnedT = Number(remittancesToday._sum.amount ?? 0);

      roleMetrics = {
        givenToday: givenT,
        returnedToday: returnedT,
        outstandingToday: givenT - returnedT,
        totalGiven: Number(totalAllocations._sum.amount_allocated ?? 0)
      };

    } else if (role === "TICKETER") {
      const activeSession = await prisma.posDeviceSession.findFirst({
        where: { user_id: userId, status: 'ACTIVE',company_id }
      });
      const activeFloat = activeSession ? Number(activeSession.pos_float) : 0;

      // Given today
      const allocationsToday = await prisma.float_allocations.aggregate({
        where: {
          pos_device: { user_id: userId },
          allocated_at: { gte: todayStart, lte: todayEnd },
          status: 'SUCCESS',company_id
        },
        _sum: { amount_allocated: true }
      });

      // Returned today
      const remittancesToday = await prisma.remittance.aggregate({
        where: {
          submitted_by: userId,
          created_at: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED',company_id
        },
        _sum: { amount: true }
      });

      const totalAllocations = await prisma.float_allocations.aggregate({
        where: {
          pos_device: { user_id: userId },
          status: 'SUCCESS',company_id
        },
        _sum: { amount_allocated: true }
      });

      roleMetrics = {
        givenToday: Number(allocationsToday._sum.amount_allocated ?? 0),
        returnedToday: Number(remittancesToday._sum.amount ?? 0),
        activeFloat,
        totalGiven: Number(totalAllocations._sum.amount_allocated ?? 0)
      };
    }

    return NextResponse.json({
      success: true,
      data: mappedEntries,
      metrics: roleMetrics
    });

  } catch (error) {
    console.error("GET /api/transaction error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
