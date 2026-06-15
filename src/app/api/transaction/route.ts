// src/app/api/transaction/route.ts

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId } = session.user;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const type = searchParams.get("type"); // CREDIT, DEBIT, or ALL

    const where: Prisma.Float_LedgerWhereInput = {};

    // 1. Role-based scoping
    if (role === "TICKETER") {
      const userSessions = await prisma.posDeviceSession.findMany({
        where: { user_id: userId },
        select: { id: true }
      });
      const sessionIds = userSessions.map(s => s.id);
      where.posSession = { in: sessionIds };

    } else if (role === "SUPERVISOR") {
      const teamTicketers = await prisma.user.findMany({
        where: { supervisor_id: userId },
        select: { id: true }
      });
      const teamUserIds = teamTicketers.map(t => t.id);

      const teamSessions = await prisma.posDeviceSession.findMany({
        where: { user_id: { in: teamUserIds } },
        select: { id: true }
      });
      const sessionIds = teamSessions.map(s => s.id);

      const supervisorAllocations = await prisma.float_allocations.findMany({
        where: { from_user: userId },
        select: { id: true }
      });
      const allocationIds = supervisorAllocations.map(a => a.id);

      where.OR = [
        { posSession: { in: sessionIds } },
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

    // Fetch ledger logs
    const entries = await prisma.float_Ledger.findMany({
      where,
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

    const mappedEntries = entries.map(e => {
      let user = "Company";
      if (e.account_type === "POS_DEVICE" && e.posDevice?.user) {
        user = `${e.posDevice.user.first_name || ""} ${e.posDevice.user.last_name || ""}`.trim();
        if (e.posDevice.device?.name) {
          user += ` (${e.posDevice.device.name})`;
        }
      }
      return {
        id: e.id,
        user,
        amount: Number(e.amount),
        entry_type: e.entry_type,
        description: e.description || "",
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
        where: { account_type: 'COMPANY' },
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
        where: { id: "COMPANY_ACCOUNT" }
      });
      const actualBalance = companyFloat ? Number(companyFloat.available_balance) : 0;
      const drift = actualBalance - ledgerNet;

      // Given Today vs Returned Today
      const allocationsToday = await prisma.float_allocations.aggregate({
        where: {
          allocated_at: { gte: todayStart, lte: todayEnd },
          status: 'SUCCESS'
        },
        _sum: { amount_allocated: true }
      });

      const remittancesToday = await prisma.remittance.aggregate({
        where: {
          created_at: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED'
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
        where: { supervisor_id: userId },
        select: { id: true }
      });
      const ticketerIds = ticketers.map(t => t.id);

      // Given today
      const allocationsToday = await prisma.float_allocations.aggregate({
        where: {
          from_user: userId,
          allocated_at: { gte: todayStart, lte: todayEnd },
          status: 'SUCCESS'
        },
        _sum: { amount_allocated: true }
      });

      // Returned today
      const remittancesToday = await prisma.remittance.aggregate({
        where: {
          submitted_by: { in: ticketerIds },
          created_at: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED'
        },
        _sum: { amount: true }
      });

      const totalAllocations = await prisma.float_allocations.aggregate({
        where: {
          from_user: userId,
          status: 'SUCCESS'
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
        where: { user_id: userId, status: 'ACTIVE' }
      });
      const activeFloat = activeSession ? Number(activeSession.pos_float) : 0;

      // Given today
      const allocationsToday = await prisma.float_allocations.aggregate({
        where: {
          pos_device: { user_id: userId },
          allocated_at: { gte: todayStart, lte: todayEnd },
          status: 'SUCCESS'
        },
        _sum: { amount_allocated: true }
      });

      // Returned today
      const remittancesToday = await prisma.remittance.aggregate({
        where: {
          submitted_by: userId,
          created_at: { gte: todayStart, lte: todayEnd },
          status: 'CONFIRMED'
        },
        _sum: { amount: true }
      });

      const totalAllocations = await prisma.float_allocations.aggregate({
        where: {
          pos_device: { user_id: userId },
          status: 'SUCCESS'
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
