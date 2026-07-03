// src/app/api/admin/audit/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

    let start: Date;
    let end: Date;

    // Parse date boundaries
    if (startDateParam) {
      start = new Date(startDateParam);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      // Default: Start of today (UTC)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      start = today;
    }

    if (endDateParam) {
      end = new Date(endDateParam);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      // Default: End of today (UTC)
      const today = new Date();
      today.setUTCHours(23, 59, 59, 999);
      end = today;
    }

    // Parallel fetch from all auditing tables
    const [
      reconciliationReports,
      auditLogs,
      remittances,
      posDeviceSessions,
      fines,
      commissionEarnings,
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
      // 4. POS Device Sessions (Returned status indicating audit review)
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
      // 5. Fines (Unpaid or Pending)
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
      // 6. Commission Earnings (Salary reviews)
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
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reconciliationReports,
        auditLogs,
        remittances,
        posDeviceSessions,
        fines,
        commissionEarnings,
      },
    });
  } catch (error) {
    console.error("Failed to fetch audit records:", error);
    return NextResponse.json({ error: "Failed to fetch audit records" }, { status: 500 });
  }
}
