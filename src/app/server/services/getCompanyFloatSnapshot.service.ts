// src/app/server/services/getCompanyFloatSnapshot.service.ts
import { prisma } from "@/lib/prisma";
import { Float_Status, RemittanceStatus } from "@prisma/client";
import { RoleFinancialSnapshot, RoleSalesSnapshot } from "@/app/types/float";
import { ApiError } from "@/app/lib/ApiError";
import type { TicketerPosSnapshot, TicketerPosSessionSummary } from "@/app/types/float";

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
    const [ledgerTopUpAgg, ledgerTopUpCancelAgg] = await Promise.all([
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


           // 6. Circulating POS Float (Sum of remaining float of all POS devices)
      const posDevices = await prisma.pos_devices.findMany({
        where: { company_id: companyId },
        select: {
          device_assignment: {
            orderBy: { assigned_at: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              pos_float: true,
              sales_reports: {
                where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
                orderBy: { submitted_at: "desc" },
                take: 1,
                select: { closing_balance: true }
              },
              remittances: {
                where: { status: "CONFIRMED" },
                select: { amount: true }
              }
            }
          }
        }
      });
      circulatingFloat = posDevices.reduce((sum, d) => {
        const latestSession = d.device_assignment[0];
        if (latestSession) {
          const latestReport = latestSession.sales_reports[0];
          if (latestReport) {
            return sum + Number(latestReport.closing_balance);
          }
          const totalConfirmedRemittances = latestSession.remittances.reduce((s, r) => s + Number(r.amount), 0);
          const remainingActiveFloat = Math.max(0, Number(latestSession.pos_float) - totalConfirmedRemittances);
          return sum + remainingActiveFloat;
        }
        return sum;
      }, 0);

      
      // 7. Supervisor Cash Holdings (Physical Cash currently accepted & held by Supervisors)
           const supervisorCashAgg = await prisma.remittance.aggregate({
        where: {
          status: { in: ["ACCEPTED_BY_SUPERVISOR", "DEPOSITED"] },
          company_id: companyId,
        },

        _sum: { amount: true },
      });
      supervisorCash = Number(supervisorCashAgg._sum.amount ?? 0);


      // 5. Ledger Reconciliations (All-Time Check to calculate Drift)
      const [allTimeCreditAgg, allTimeDebitAgg] = await Promise.all([
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

     // 5. Circulating POS Float under this Supervisor (Sum of remaining float of POS devices assigned to this supervisor's ticketers)
      const supervisorDevices = await prisma.pos_devices.findMany({
        where: {
          company_id: companyId,
          device_assignment: {
            some: {
              user: { supervisor_id: userId }
            }
          }
        },
        select: {
          device_assignment: {
            orderBy: { assigned_at: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              pos_float: true,
              user: { select: { supervisor_id: true } },
              sales_reports: {
                where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
                orderBy: { submitted_at: "desc" },
                take: 1,
                select: { closing_balance: true }
              },
              remittances: {
                where: { status: "CONFIRMED" },
                select: { amount: true }
              }
            }
          }
        }
      });
      circulatingFloat = supervisorDevices.reduce((sum, d) => {
        const latestSession = d.device_assignment[0];
        if (latestSession && latestSession.user?.supervisor_id === userId) {
          const latestReport = latestSession.sales_reports[0];
          if (latestReport) {
            return sum + Number(latestReport.closing_balance);
          }
          const totalConfirmedRemittances = latestSession.remittances.reduce((s, r) => s + Number(r.amount), 0);
          const remainingActiveFloat = Math.max(0, Number(latestSession.pos_float) - totalConfirmedRemittances);
          return sum + remainingActiveFloat;
        }
        return sum;
      }, 0);

           // 6. Supervisor Cash Holdings (Cash currently accepted & held in hand)
      const supervisorCashAgg = await prisma.remittance.aggregate({
        where: {
          status: "ACCEPTED_BY_SUPERVISOR",
          received_by_supervisor_id: userId,
          company_id: companyId,
        },
        _sum: { amount: true }
      });
      supervisorCash = Number(supervisorCashAgg._sum.amount ?? 0);




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
        status: { notIn: ["REJECTED", "CANCELLED"] } 
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

 const [confirmedAgg, pendingAgg, companyConfirmedAgg] = await Promise.all([
  prisma.remittance.aggregate({
    where: {
      ...submittedByFilter,
      status: RemittanceStatus.CONFIRMED,
      ...getDateRangeFilter(fromDate, toDate, "remittance_date"),
      company_id: companyId,
    },
    _sum: { amount: true },
  }),
  prisma.remittance.aggregate({
    where: {
      ...submittedByFilter,
      status: RemittanceStatus.PENDING,
      ...getDateRangeFilter(fromDate, toDate, "remittance_date"),
      company_id: companyId,
    },
    _sum: { amount: true },
  }),
  prisma.remittance.aggregate({
    where: {
      ...submittedByFilter,
      status: RemittanceStatus.CONFIRMED,
      ...getDateRangeFilter(fromDate, toDate, "remittance_date"),
      company_id: companyId,
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




export async function fetchTicketerPosSnapshot(
  userId: string,
  companyId: string,
  fromDate?: Date | null,
  toDate?: Date | null,
  selectedSessionId?: string | null
): Promise<TicketerPosSnapshot> {
  try {
    // 1. Fetch available POS sessions for this ticketer (Capped at top 20 most recent to prevent performance issues)
    const availableSessions = await prisma.posDeviceSession.findMany({
      where: { user_id: userId, company_id: companyId },
      include: { device: { select: { name: true, serial_number: true } } },
      orderBy: { assigned_at: "desc" },
      take: 20,
    });

    const sessionsList: TicketerPosSessionSummary[] = availableSessions.map((s) => ({
      id: s.id,
      deviceName: s.device.name,
      serialNumber: s.device.serial_number,
      status: s.status,
      assignedAt: s.assigned_at,
      unassignedAt: s.unassigned_at,
    }));

    // 2. Fallback: User has no POS session history at all
    if (sessionsList.length === 0) {
      return {
        success: true,
        message: "No POS session history found for this user",
        status: 200,
        data: {
          pos_device_id: "",
          sessionStatus: "NONE",
          deviceName: "N/A",
          closingBalance: 0,
          totalTopUp: 0,
          effectiveOpening: 0,
          expectedRemittance: 0,
          sessionsList: [],
          topUp: [],
        },
      };
    }

    // 3. Resolve target session: requested sessionId OR default to active/most recent session
    let targetSession = availableSessions.find((s) => s.id === selectedSessionId);
    if (!targetSession) {
      targetSession = availableSessions.find((s) => s.status === "ACTIVE") || availableSessions[0];
    }

    const pos_device_id = targetSession.id;
    const hasDateFilter = fromDate != null && toDate != null;
    const dateFilter = hasDateFilter
      ? { allocated_at: { gte: fromDate!, lte: toDate! } }
      : {};

       // 4. Fetch session details with sales reports and allocations
    const pos = await prisma.posDeviceSession.findUnique({
      where: { id: pos_device_id, company_id: companyId },
      include: {
        device: { select: { name: true } },
        // Include PENDING or VERIFIED sales reports (excludes CANCELLED/REJECTED)
        sales_reports: { 
          where: { status: { in: ["PENDING", "VERIFIED"] } }, 
          orderBy: { report_date: "desc" }, 
          take: 1 
        },
        allocations_given: {
          where: { status: Float_Status.SUCCESS, ...dateFilter, company_id: companyId },
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

    // 1. Fetch all successful top-ups received during this session
    const topupAggregate = await prisma.float_allocations.aggregate({
      where: { pos_device_id, status: Float_Status.SUCCESS, ...dateFilter, company_id: companyId },
      _sum: { amount_allocated: true },
    });

    const totalTopUp = Number(topupAggregate._sum.amount_allocated ?? 0);

    // 2. Compute opening, closing, and effective balances cleanly
    let effectiveOpening = 0;   // Initial float + Top-ups (total allocated)
    let closingBalance = 0;     // Device float at the end of the session

    if (pos.status === "ACTIVE") {
      // For active sessions, current pos_float is the total float (includes top-ups)
      effectiveOpening = Number(pos.pos_float);
      closingBalance = Number(pos.pos_float); // Active device still has full float
    } else {
      const salesReport = pos.sales_reports[0];
      if (salesReport) {
        // Sales report opening balance already includes top-ups
        effectiveOpening = Number(salesReport.opening_balance);
        closingBalance = Number(salesReport.closing_balance);
      } else {
        effectiveOpening = Number(pos.pos_float);
        closingBalance = Number(pos.pos_float);
      }
    }

    // 3. Expected remittance is what was sold: effectiveOpening - closingBalance
    // For ACTIVE sessions this will naturally compute to 0
    const expectedRemittance = Math.max(0, effectiveOpening - closingBalance);




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
        sessionStatus: pos.status,
        deviceName: pos.device.name,
        closingBalance,
        totalTopUp,
        effectiveOpening,
        expectedRemittance,
        sessionsList,
        topUp,
      },
    };
  } catch (error) {
    console.error("fetchTicketerPosSnapshot error:", error);
    throw error instanceof ApiError ? error : new ApiError(500, "Internal server error");
  }
}


