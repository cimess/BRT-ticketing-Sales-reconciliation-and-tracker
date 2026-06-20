// src/app/server/services/getCompanyFloatSnapshot.service.ts
import { prisma } from "@/lib/prisma";
import { Float_Status, RemittanceStatus } from "@prisma/client";
import { RoleFinancialSnapshot, RoleSalesSnapshot } from "@/app/types/float";
import { ApiError } from "@/app/lib/ApiError";

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────



// Helper to construct date filters. Defaults to "Today" start and end if null.
function getDateRangeFilter(
  fromDate: Date | null | undefined,
  toDate: Date | null | undefined,
  fieldName: string
) {
  if (fromDate && toDate) {
    return {
      [fieldName]: {
        gte: new Date(fromDate),
        lte: new Date(toDate),
      },
    };
  }
  // Default fallback: Today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return {
    [fieldName]: {
      gte: todayStart,
      lte: todayEnd,
    },
  };
}

// ─── 1. ROLE FINANCIAL SNAPSHOT ──────────────────────────────────────────────

export async function getRoleFinancialSnapshot(
  role: string,
  userId: string,
  companyId: string,
  fromDate?: Date | null,
  toDate?: Date | null,
): Promise<RoleFinancialSnapshot> {
  try {
    const isClientAdmin = role === "ADMIN" || role === "AUDITOR";
    const isClientSupervisor = role === "SUPERVISOR";
    const isClientTicketer = role === "TICKETER";

    let companyBalance = 0;
    let totalTopUp = 0;
    let totalAllocated = 0;
    let expectedRemittance = 0;
    let reconciliationData;
    let posSessionId;
    let circulatingFloat = 0;
    let supervisorCash = 0;

    // ─────────────────────────────────────────────────────
    // A. ADMIN & AUDITOR Snapshots (All-Time + Range Checks)
    // ─────────────────────────────────────────────────────
    if (isClientAdmin) {
      // 1. Get Cached/Current available balance
      const companyFloat = await prisma.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: companyId },
      });
      companyBalance = companyFloat ? Number(companyFloat.available_balance) : 0;

      // 2. Total Top-ups (Credits to Company Account in range minus cancel debits)
      const [ledgerTopUpAgg, ledgerTopUpCancelAgg] = await prisma.$transaction([
        prisma.float_Ledger.aggregate({
          where: {
            account_id: "COMPANY_ACCOUNT",
            entry_type: "CREDIT",
            reference_type: "TOP_UP",
            ...getDateRangeFilter(fromDate, toDate, "created_at"),
            company_id: companyId,
          },
          _sum: { amount: true },
        }),
        prisma.float_Ledger.aggregate({
          where: {
            account_id: "COMPANY_ACCOUNT",
            entry_type: "DEBIT",
            reference_type: "TOP_UP_CANCEL",
            ...getDateRangeFilter(fromDate, toDate, "created_at"),
            company_id: companyId,
          },
          _sum: { amount: true },
        })
      ]);
      totalTopUp = Number(ledgerTopUpAgg._sum.amount ?? 0) - Number(ledgerTopUpCancelAgg._sum.amount ?? 0);

      // 3. Total Allocated (Debits to Company Account in range minus cancel credits)
      const posAllocationsAgg = await prisma.float_allocations.aggregate({
        where: {
          status: "SUCCESS", // Excludes CANCELLED/REVERSED allocations
          ...getDateRangeFilter(fromDate, toDate, "allocated_at"),
          company_id: companyId,
        },
        _sum: { amount_allocated: true }
      });

      totalAllocated = Number(posAllocationsAgg._sum.amount_allocated ?? 0);



      // 4. Expected Remittances (Expectations due in range)
      const expectationAgg = await prisma.remittanceExpectation.aggregate({
        where: {
          ...getDateRangeFilter(fromDate, toDate, "due_date"),
          company_id: companyId,
        },
        _sum: { expected_amount: true },
      });
      expectedRemittance = Number(expectationAgg._sum.expected_amount ?? 0);

      // 6. Circulating POS Float (Sum of pos_float of all ACTIVE sessions)
      const activeSessions = await prisma.posDeviceSession.findMany({
        where: { status: "ACTIVE", company_id: companyId },
        select: { pos_float: true }
      });
      circulatingFloat = activeSessions.reduce((sum, s) => sum + Number(s.pos_float), 0);

      // 7. Supervisor Cash Holdings (Cash with Supervisors)
      const collectedBySupervisorsAgg = await prisma.remittance.aggregate({
        where: {
          status: "CONFIRMED",
          received_by_supervisor_id: { not: null },
          company_id: companyId,
        },
        _sum: { amount: true },
      });
      const totalCollectedBySupervisors = Number(collectedBySupervisorsAgg._sum.amount ?? 0);

      const supervisors = await prisma.user.findMany({
        where: { role: "SUPERVISOR", company_id: companyId },
        select: { id: true },
      });
      const supervisorIds = supervisors.map((u) => u.id);

      const depositedBySupervisorsAgg = await prisma.remittance.aggregate({
        where: {
          status: "CONFIRMED",
          submitted_by: { in: supervisorIds },
          received_by_supervisor_id: null,
          company_id: companyId,
        },
        _sum: { amount: true },
      });
      const totalDepositedBySupervisors = Number(depositedBySupervisorsAgg._sum.amount ?? 0);
      supervisorCash = totalCollectedBySupervisors - totalDepositedBySupervisors;


      // 5. Ledger Reconciliations (All-Time Check to calculate Drift)
      const [allTimeCreditAgg, allTimeDebitAgg] = await prisma.$transaction([
        prisma.float_Ledger.aggregate({
          where: { account_id: "COMPANY_ACCOUNT", entry_type: "CREDIT", company_id: companyId },
          _sum: { amount: true },
        }),
        prisma.float_Ledger.aggregate({
          where: { account_id: "COMPANY_ACCOUNT", entry_type: "DEBIT", company_id: companyId },
          _sum: { amount: true },
        }),
      ]);
      const allTimeCredits = Number(allTimeCreditAgg._sum.amount ?? 0);
      const allTimeDebits = Number(allTimeDebitAgg._sum.amount ?? 0);
      const computedBalance = allTimeCredits - allTimeDebits;
      const drift = computedBalance - companyBalance;

      reconciliationData = {
        totalCredits: allTimeCredits,
        totalDebits: allTimeDebits,
        computedBalance,
        drift,
        isInSync: Math.abs(drift) < 0.01,
      };
    }

    // ─────────────────────────────────────────────────────
    // B. SUPERVISOR Snapshot (Subordinates Checks)
    // ─────────────────────────────────────────────────────
    else if (isClientSupervisor) {

      // 5. Circulating POS Float under this Supervisor
      const supervisorActiveSessions = await prisma.posDeviceSession.findMany({
        where: {
          status: "ACTIVE",
          user: { supervisor_id: userId },
          company_id: companyId,
        },
        select: { pos_float: true }
      });
      circulatingFloat = supervisorActiveSessions.reduce((sum, s) => sum + Number(s.pos_float), 0);

      // 6. Supervisor Cash Holdings (Their own cash-in-hand)
      const collectedBySupAgg = await prisma.remittance.aggregate({
        where: {
          status: "CONFIRMED",
          received_by_supervisor_id: userId,
          company_id: companyId,
        },
        _sum: { amount: true }
      });
      const totalCollectedBySup = Number(collectedBySupAgg._sum.amount ?? 0);

      const depositedBySupAgg = await prisma.remittance.aggregate({
        where: {
          status: "CONFIRMED",
          submitted_by: userId,
          received_by_supervisor_id: null,
          company_id: companyId,
        },
        _sum: { amount: true }
      });
      const totalDepositedBySup = Number(depositedBySupAgg._sum.amount ?? 0);
      supervisorCash = totalCollectedBySup - totalDepositedBySup;



      // Available Company float (the pot they draw allocations from)
      const companyFloat = await prisma.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT", company_id: companyId },
      });
      companyBalance = companyFloat ? Number(companyFloat.available_balance) : 0;

      // Supervisor does not receive top-ups directly
      totalTopUp = 0;

      // Total Allocated by this Supervisor in range
      const supervisorAllocAgg = await prisma.float_allocations.aggregate({
        where: {
          from_user: userId,
          status: Float_Status.SUCCESS,
          ...getDateRangeFilter(fromDate, toDate, "allocated_at"),
          company_id: companyId,
        },
        _sum: { amount_allocated: true },
      });
      totalAllocated = Number(supervisorAllocAgg._sum.amount_allocated ?? 0);

      // Expected Remittances from all Ticketers assigned to this Supervisor
      const ticketers = await prisma.user.findMany({
        where: { supervisor_id: userId, company_id: companyId },
        select: { id: true },
      });
      const ticketerIds = ticketers.map((t) => t.id);

      const expectationAgg = await prisma.remittanceExpectation.aggregate({
        where: {
          user_id: { in: ticketerIds },
          ...getDateRangeFilter(fromDate, toDate, "due_date"),
          company_id: companyId,
        },
        _sum: { expected_amount: true },
      });
      expectedRemittance = Number(expectationAgg._sum.expected_amount ?? 0);
    }

    // ─────────────────────────────────────────────────────
    // C. TICKETER Snapshot (Personal POS Session Checks)
    // ─────────────────────────────────────────────────────
    else if (isClientTicketer) {

      const activeSession = await prisma.posDeviceSession.findFirst({
        where: { user_id: userId, status: "ACTIVE", company_id: companyId },
      });
      posSessionId = activeSession?.id || null;
      companyBalance = activeSession ? Number(activeSession.pos_float) : 0;

      const activeSessionId = activeSession?.id || "";

      // Total Top-up allocations received in range
      const ticketerTopUpAgg = await prisma.float_allocations.aggregate({
        where: {
          pos_device_id: activeSessionId,
          status: Float_Status.SUCCESS,
          ...getDateRangeFilter(fromDate, toDate, "allocated_at"),
          company_id: companyId,
        },
        _sum: { amount_allocated: true },
      });
      totalTopUp = Number(ticketerTopUpAgg._sum.amount_allocated ?? 0);

      // Ticketer cannot allocate further
      totalAllocated = 0;

      // Expected Remittances in range
      const expectationAgg = await prisma.remittanceExpectation.aggregate({
        where: {
          user_id: userId,
          ...getDateRangeFilter(fromDate, toDate, "due_date"),
          company_id: companyId,
        },
        _sum: { expected_amount: true },
      });
      expectedRemittance = Number(expectationAgg._sum.expected_amount ?? 0);

      // Fallback: If no expectations generated, expected = last closing balance + topup
      if (expectedRemittance === 0 && activeSession) {
        const lastReport = await prisma.salesReport.findFirst({
          where: { ticketer_id: userId, company_id: companyId },
          orderBy: { report_date: "desc" },

        });
        const closingBalance = lastReport ? Number(lastReport.closing_balance) : 0;
        expectedRemittance = closingBalance + totalTopUp;
      }
    }

    return {
      success: true,
      message: `${role} financial snapshot computed successfully`,
      data: {
        role,
        companyBalance,
        totalTopUp,
        totalAllocated,
        expectedRemittance,
        circulatingFloat,
        supervisorCash,
        ...(reconciliationData && { ledgerReconciliation: reconciliationData }),
        posSessionId,
      },
    };

  } catch (error) {
    console.error("getRoleFinancialSnapshot error:", error);
    throw error instanceof ApiError
      ? error
      : new ApiError(500, "Internal server error");
  }
}

// ─── 2. ROLE SALES SNAPSHOT ──────────────────────────────────────────────────

export async function getRoleSalesSnapshot(
  role: string,
  userId: string,
  companyId:string,
  fromDate?: Date | null,
  toDate?: Date | null,
): Promise<RoleSalesSnapshot> {
  try {
    const isClientAdmin = role === "ADMIN" || role === "AUDITOR";
    const isClientSupervisor = role === "SUPERVISOR";

    let ticketerFilter = {};

    // 1. Resolve which ticketers we care about based on role
    if (isClientSupervisor) {
      const ticketers = await prisma.user.findMany({
        where: { supervisor_id: userId,company_id:companyId },
        select: { id: true },
      });
      const ticketerIds = ticketers.map((t) => t.id);
      ticketerFilter = { ticketer_id: { in: ticketerIds } };
    } else if (!isClientAdmin) {
      // Ticketer only views their own sales
      ticketerFilter = { ticketer_id: userId };
    }

    // 2. Query Sales Reports (sum of total_sold)
    const salesReportAgg = await prisma.salesReport.aggregate({
      where: {
        ...ticketerFilter,
        ...getDateRangeFilter(fromDate, toDate, "report_date"),
        company_id:companyId,
      },
      _sum: { total_sold: true },
      _count: { id: true },
    });
    const totalSales = Number(salesReportAgg._sum.total_sold ?? 0);
    const salesCount = salesReportAgg._count.id;

    // 3. Query Remittances (Confirmed vs Pending)
    const submittedByFilter = isClientAdmin
      ? {}
      : isClientSupervisor
        ? { ticketer: { supervisor_id: userId } }
        : { submitted_by: userId };

    const [confirmedAgg, pendingAgg, companyConfirmedAgg] = await prisma.$transaction([
      prisma.remittance.aggregate({
        where: {
          ...submittedByFilter,
          status: RemittanceStatus.CONFIRMED,
          ...getDateRangeFilter(fromDate, toDate, "remittance_date"),
          company_id:companyId,
        },
        _sum: { amount: true },
      }),
      prisma.remittance.aggregate({
        where: {
          ...submittedByFilter,
          status: RemittanceStatus.PENDING,
          ...getDateRangeFilter(fromDate, toDate, "remittance_date"),
          company_id:companyId,
        },
        _sum: { amount: true },
      }),
      prisma.remittance.aggregate({
        where: {
          ...submittedByFilter,
          status: RemittanceStatus.CONFIRMED,
          received_by_supervisor_id: null, // DIRECT TO BANK/COMPANY VAULT ONLY
          ...getDateRangeFilter(fromDate, toDate, "remittance_date"),
          company_id:companyId,
        },
        _sum: { amount: true },
      }),
    ]);

    const totalRemitted = Number(confirmedAgg._sum.amount ?? 0);
    const pendingRemittance = Number(pendingAgg._sum.amount ?? 0);
    const companyRemitted = Number(companyConfirmedAgg._sum.amount ?? 0);

    return {
      success: true,
      message: `${role} sales snapshot computed successfully`,
      data: {
        role,
        totalSales,
        totalRemitted,
        pendingRemittance,
        companyRemitted,
        salesCount,
      },
    };

  } catch (error) {
    console.error("getRoleSalesSnapshot error:", error);
    throw error instanceof ApiError
      ? error
      : new ApiError(500, "Internal server error");
  }
}


export type TicketerPosSnapshot = {
  success: boolean;
  message: string;
  status: number;
  data: {
    pos_device_id: string;
    closingBalance: number;
    totalTopUp: number;
    effectiveOpening: number;
    expectedRemittance: number;
    topUp: {
      id: string;
      amount_allocated: number;
      pos_device_id: string;
      status: Float_Status;
      allocated_at: Date;
      from_user_name: string;
      from_user_role: string;
      to_device_name: string;
    }[];
  } | null;
};

export async function fetchTicketerPosSnapshot(
  userId: string,
  companyId:string,
  fromDate?: Date | null,
  toDate?: Date | null
): Promise<TicketerPosSnapshot> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId,company_id:companyId },
      include: {
        pos_sessions: { where: { status: "ACTIVE" } },
      },
    });

    if (!user) throw new ApiError(404, "User not found");
    if (!user.pos_sessions || user.pos_sessions.length === 0) {
      throw new ApiError(404, "No active POS session assigned to this user");
    }

    const pos_device_id = user.pos_sessions[0].id;
    const hasDateFilter = fromDate != null && toDate != null;
    const dateFilter = hasDateFilter
      ? { allocated_at: { gte: fromDate!, lte: toDate! } }
      : {};

    const pos = await prisma.posDeviceSession.findUnique({
      where: { id: pos_device_id,company_id:companyId },
      include: {
        sales_reports: { orderBy: { report_date: "desc" }, take: 1 },
        allocations_given: {
          where: { status: Float_Status.SUCCESS, ...dateFilter,company_id:companyId },
          include: {
            supervisor: { select: { first_name: true, last_name: true, role: true } },
            pos_device: { include: { device: { select: { name: true } } } },
          },
          orderBy: { allocated_at: "desc" },
          take: 20,
        },
      },
    });

    if (!pos) throw new ApiError(404, "POS session not found");

    const previousSalesReport = pos.sales_reports[0];
    const closingBalance = Number(previousSalesReport?.closing_balance ?? 0);

    const topupAggregate = await prisma.float_allocations.aggregate({
      where: { pos_device_id, status: Float_Status.SUCCESS, ...dateFilter,company_id:companyId },
      _sum: { amount_allocated: true },
    });

    const totalTopUp = Number(topupAggregate._sum.amount_allocated ?? 0);
    const effectiveOpening = closingBalance + totalTopUp;
    const expectedRemittance = effectiveOpening;

    const topUp = pos.allocations_given.map((allocation) => ({
      id: allocation.id,
      amount_allocated: Number(allocation.amount_allocated),
      pos_device_id,
      status: allocation.status,
      allocated_at: allocation.allocated_at,
      from_user_name: `${allocation.supervisor.first_name || ""} ${allocation.supervisor.last_name || ""}`.trim(),
      from_user_role: allocation.supervisor.role,
      to_device_name: allocation.pos_device.device.name,
    }));

    return {
      success: true,
      message: "POS snapshot computed successfully",
      status: 200,
      data: {
        pos_device_id,
        closingBalance,
        totalTopUp,
        effectiveOpening,
        expectedRemittance,
        topUp,
      },
    };
  } catch (error) {
    console.error("fetchTicketerPosSnapshot error:", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}
