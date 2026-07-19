// src/app/api/admin/audit/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/app/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !session.user.id || !session.user.company_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, company_id } = session.user;

    // Security Gate: Only Admins and Auditors can view company audit logs
    if (role !== "ADMIN" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Forbidden: Auditor or Admin role required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const cacheKey = `cache:audit:${company_id}:${startDateParam || "today"}:${endDateParam || "today"}`;
    const cachedAudit = await cacheGet(cacheKey);
    if (cachedAudit) {
      return NextResponse.json(cachedAudit);
    }

    let start: Date;
    let end: Date;

    // Parse date boundaries for the table logs
    if (startDateParam) {
      start = new Date(startDateParam);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      start = today;
    }

    if (endDateParam) {
      end = new Date(endDateParam);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      end = today;
    }

    // Chart Time Boundaries: last 30 days
    const chartStartDate = new Date();
    chartStartDate.setUTCDate(chartStartDate.getUTCDate() - 30);
    chartStartDate.setUTCHours(0, 0, 0, 0);

    // Parallel fetch from all auditing & chart tables
    const [
      reconciliationReports,
      auditLogs,
      remittances,
      posDeviceSessions,
      fines,
      commissionEarnings,
      chartSalesReports,
      chartExpectations,
    ] = await Promise.all([
      // 1. Reconciliation Reports
      prisma.reconciliation_reports.findMany({
        where: {
          company_id,
          generated_at: { gte: start, lte: end },
          status: { notIn: ["MATCHED", "RESOLVED"] },
        },
        orderBy: { generated_at: "desc" },
      }),
      // 2. Audit Logs
      prisma.auditLog.findMany({
        where: {
          company_id,
          created_at: { gte: start, lte: end },
        },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
              role: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      // 3. Remittances
      prisma.remittance.findMany({
        where: {
          company_id,
          created_at: { gte: start, lte: end },
        },
        include: {
          ticketer: {
            select: {
              first_name: true,
              last_name: true,
              role: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      // 4. POS Device Sessions
      prisma.posDeviceSession.findMany({
        where: {
          company_id,
          assigned_at: { gte: start, lte: end },
          status: "RETURNED",
        },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
          device: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { assigned_at: "desc" },
      }),
      // 5. Fines
      prisma.fine.findMany({
        where: {
          company_id,
          created_at: { gte: start, lte: end },
          status: { in: ["UNPAID", "PENDING"] },
        },
        include: {
          defaulter: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
          issuer: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      // 6. Commission Earnings
      prisma.commissionEarning.findMany({
        where: {
          company_id,
          created_at: { gte: start, lte: end },
        },
        include: {
          user: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      // 7. Sales Reports (For Chart)
      prisma.salesReport.findMany({
        where: {
          company_id,
          submitted_at: { gte: chartStartDate },
        },
        select: {
          submitted_at: true,
          total_sold: true,
        },
      }),
      // 8. Remittance Expectations (For Chart)
      prisma.remittanceExpectation.findMany({
        where: {
          company_id,
          created_at: { gte: chartStartDate },
        },
        select: {
          created_at: true,
          expected_amount: true,
        },
      }),
    ]);

    const now = new Date();

    // --- 1D CHART (Last 24 Hours) ---
    const revenueData1d = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourStr = `${String(d.getHours()).padStart(2, "0")}:00`;

      const hourStart = new Date(d);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(d);
      hourEnd.setMinutes(59, 59, 999);

      const sales = chartSalesReports
        .filter((r) => r.submitted_at >= hourStart && r.submitted_at <= hourEnd)
        .reduce((sum, r) => sum + r.total_sold, 0);

      const expected = chartExpectations
        .filter((e) => e.created_at >= hourStart && e.created_at <= hourEnd)
        .reduce((sum, e) => sum + e.expected_amount, 0);

      revenueData1d.push({ name: hourStr, sales, expected });
    }

    // --- 7D CHART (Last 7 Days) ---
    const revenueData7d = [];
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = weekdays[d.getDay()];

      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);

      const sales = chartSalesReports
        .filter((r) => r.submitted_at >= dayStart && r.submitted_at <= dayEnd)
        .reduce((sum, r) => sum + r.total_sold, 0);

      const expected = chartExpectations
        .filter((e) => e.created_at >= dayStart && e.created_at <= dayEnd)
        .reduce((sum, e) => sum + e.expected_amount, 0);

      revenueData7d.push({ name: label, sales, expected });
    }

    // --- 30D CHART (Last 4 Weeks) ---
    const revenueData30d = [];
    for (let w = 3; w >= 0; w--) {
      const label = `Week ${4 - w}`;

      const weekStart = new Date(now.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);

      const sales = chartSalesReports
        .filter((r) => r.submitted_at >= weekStart && r.submitted_at < weekEnd)
        .reduce((sum, r) => sum + r.total_sold, 0);

      const expected = chartExpectations
        .filter((e) => e.created_at >= weekStart && e.created_at < weekEnd)
        .reduce((sum, e) => sum + e.expected_amount, 0);

      revenueData30d.push({ name: label, sales, expected });
    }

    const responsePayload = {
      success: true,
      data: {
        reconciliationReports,
        auditLogs,
        remittances,
        posDeviceSessions,
        fines,
        commissionEarnings,
        charts: {
          revenueData1d,
          revenueData7d,
          revenueData30d,
        },
      },
    };

    await cacheSet(cacheKey, responsePayload, 60); // 1 min TTL
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Failed to fetch audit records:", error);
    return NextResponse.json({ error: "Failed to fetch audit records" }, { status: 500 });
  }
}
