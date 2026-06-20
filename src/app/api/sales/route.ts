// src/app/api/sales/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { role, id: userId, company_id } = session.user;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const filterTicketerId = searchParams.get("ticketerId") || searchParams.get("userId");

    const whereClause: Prisma.SalesReportWhereInput = { company_id };

    // 1. Role-based scoping
    if (role === "TICKETER") {
      // Ticketers can only view their own reports
      whereClause.ticketer_id = userId;
    } else if (role === "SUPERVISOR") {
      // Supervisors default to seeing reports from ticketers they supervise
      whereClause.ticketer = {
        supervisor_id: userId
      };

      // If supervisor filters by a specific ticketer, verify that ticketer is supervised by them
      if (filterTicketerId) {
        whereClause.ticketer_id = filterTicketerId;
      }
    } else if (role === "ADMIN" || role === "AUDITOR") {
      // Admins/Auditors can see all reports, optional filter by ticketer
      if (filterTicketerId) {
        whereClause.ticketer_id = filterTicketerId;
      }
    }

    // 2. Date Filtering (using report_date or submitted_at)
    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        // Adjust end date to include the full day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      whereClause.report_date = dateFilter;
    }

    const reports = await prisma.salesReport.findMany({
      where: whereClause,
      orderBy: { submitted_at: "desc" },
      include: {
        location: { select: { name: true } },
        pos_device: { include: { device: { select: { name: true } } } },
        ticketer: { select: { first_name: true, last_name: true } }
      }
    });

    return NextResponse.json({
      success: true,
      reports: reports.map(r => ({
        id: r.id,
        ticketer_id: r.ticketer_id,
        user_name: `${r.ticketer.first_name} ${r.ticketer.last_name}`.trim(),
        pos_session_id: r.pos_device.device.name,
        location_id: r.location.name,
        opening_balance: r.opening_balance,
        closing_balance: r.closing_balance,
        total_sold: r.total_sold,
        submitted_at: r.submitted_at.toISOString(),
        report_date: r.report_date.toISOString(),
        status: r.status
      }))
    });
  } catch (error) {
    console.error("GET /api/sales error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: callerId, role: callerRole, company_id } = session.user;
    const body = await req.json();
    const { posSessionId, locationId, openingBalance, closingBalance, totalSold, targetTicketerId } = body;

    // Determine who the report is for (Ticketer reporting for self or Supervisor reporting on behalf of target)
    let ticketerId = callerId;
    if (callerRole === "SUPERVISOR" || callerRole === "ADMIN") {
      if (!targetTicketerId) {
        return NextResponse.json({ error: "targetTicketerId is required for supervisors/admins" }, { status: 400 });
      }
      ticketerId = targetTicketerId;
    }

    const openVal = Number(openingBalance);
    const closeVal = Number(closingBalance);
    const soldVal = Number(totalSold);

    const report = await prisma.$transaction(async (tx) => {
      // Fetch target POS session
      const sessionRecord = await tx.posDeviceSession.findFirst({
        where: { id: posSessionId, company_id }
      });
      if (!sessionRecord) throw new ApiError(404, "POS session not found");

      // Verify the target ticketer matches the session user
      if (sessionRecord.user_id !== ticketerId) {
        throw new ApiError(400, "Ticketer does not match the POS session assignee");
      }

      // Check if report already exists
      const existingReport = await tx.salesReport.findFirst({
        where: { pos_session_id: posSessionId, company_id }
      });
      if (existingReport) throw new ApiError(400, "Report already submitted for this session");

      // Create Sales Report as PENDING (no expectations modified until Admin verifies)
      const newReport = await tx.salesReport.create({
        data: {
          company_id,
          ticketer_id: ticketerId,
          pos_session_id: posSessionId,
          location_id: locationId,
          opening_balance: openVal,
          closing_balance: closeVal,
          total_sold: soldVal,
          report_day: new Date(),
          report_date: new Date(),
          status: "PENDING"
        }
      });

      // Audit logging
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: callerId,
          action: "CREATE",
          entity_type: "SALES_REPORT",
          entity_id: newReport.id,
          after_state: newReport as unknown as Prisma.InputJsonValue
        }
      });

      return newReport;
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("POST /api/sales error:", error);
    return NextResponse.json({ 
      error: error instanceof ApiError ? error.message : "Internal Server Error" 
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
