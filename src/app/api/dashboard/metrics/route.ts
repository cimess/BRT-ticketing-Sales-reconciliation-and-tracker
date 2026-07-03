// src/app/api/dashboard/metrics/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRoleFinancialSnapshot, getRoleSalesSnapshot } from "@/server/services/getCompanyFloatSnapshot.service";
import { checkAndEscalateExpectations, checkSupervisorDepositViolations } from "@/server/services/escalation.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !session.user.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, role,company_id:companyId } = session.user;
    await checkAndEscalateExpectations(companyId);
    await checkSupervisorDepositViolations(companyId);


    // 1. Financial snapshot (company balance, topups, allocations, expected remittance)
    const financialSnapshot = await getRoleFinancialSnapshot(role, userId,companyId);

    // 2. Sales snapshot (total sales, confirmed remitted, pending remittance)
    const salesSnapshot = await getRoleSalesSnapshot(role, userId,companyId);

      let alertCount = 0;
    let shortageCount = 0;
    
    if (role === "ADMIN" || role === "AUDITOR") {
      alertCount = await prisma.fine.count({ where: { company_id: companyId, status: "UNPAID" } });
      shortageCount = await prisma.remittanceExpectation.count({
        where: { company_id: companyId, status: { in: ["OVERDUE", "VIOLATED"] } }
      });
    }   
      else if (role === "SUPERVISOR") {
      // Count both fines issued BY them and fines issued TO them
      alertCount = await prisma.fine.count({ 
        where: { 
          company_id: companyId, 
          status: "UNPAID",
          OR: [
            { issued_by: userId },
            { defaulter_id: userId }
          ]
        } 
      });
      const supervisedUsers = await prisma.user.findMany({
        where: { supervisor_id: userId, company_id: companyId },
        select: { id: true }
      });
      const supervisedIds = supervisedUsers.map(u => u.id);
      supervisedIds.push(userId); // Include supervisor's own shortages
      shortageCount = await prisma.remittanceExpectation.count({
        where: {
          company_id: companyId,
          user_id: { in: supervisedIds },
          status: { in: ["OVERDUE", "VIOLATED"] }
        }
      });
    }
 else if (role === "TICKETER") {
      alertCount = await prisma.fine.count({ where: { defaulter_id: userId, company_id: companyId, status: "UNPAID" } });
      shortageCount = await prisma.remittanceExpectation.count({
        where: {
          company_id: companyId,
          user_id: userId,
          status: { in: ["OVERDUE", "VIOLATED"] }
        }
      });
    }
    const totalAlertCount = alertCount + shortageCount;
    return NextResponse.json({
      success: true,
      metrics: {
        availableFloat: financialSnapshot.data.companyBalance,
        salesToday: salesSnapshot.data.totalSales,
        pendingRemittances: salesSnapshot.data.pendingRemittance,
        alertCount:totalAlertCount,
        totalTopUps: financialSnapshot.data.totalTopUp,
        totalAllocated: financialSnapshot.data.totalAllocated,
        expectedRemittance: financialSnapshot.data.expectedRemittance,
        totalRemitted: salesSnapshot.data.totalRemitted,
        companyRemitted: salesSnapshot.data.companyRemitted || 0,
        circulatingFloat: financialSnapshot.data.circulatingFloat || 0,
        supervisorCash: financialSnapshot.data.supervisorCash || 0,
        posSessionId: financialSnapshot.data.posSessionId || null,
        ...(financialSnapshot.data.ledgerReconciliation && {
          ledgerReconciliation: financialSnapshot.data.ledgerReconciliation,
        }),
      },
    });

  } catch (error) {
    console.error("GET /api/dashboard/metrics error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
