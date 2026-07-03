// src/app/api/sales/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { Prisma } from "@prisma/client";
import { rulesQueue } from "@/lib/queue";
import { runRuleEvaluation } from "@/app/workers/rulesWorker";

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
    // Parse query parameters
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10))) : 50; // Max 100, default 50
    const skip = (page - 1) * limit;

    const reports = await prisma.salesReport.findMany({
      where: { ...whereClause },
      orderBy: { submitted_at: "desc" },
      skip,
      take: limit,
      include: {
        location: { select: { name: true } },
        pos_device: {
          include: {
            device: { select: { name: true } },
            allocations_given: { select: { amount_allocated: true } }
          }
        },
        ticketer: { select: { first_name: true, last_name: true } }
      }
    });


    return NextResponse.json({
      success: true,
      reports: reports.map(r => {
        const topUp = r.pos_device.allocations_given.reduce(
          (sum, alloc) => sum + Number(alloc.amount_allocated),
          0
        );
        return {
          id: r.id,
          ticketer_id: r.ticketer_id,
          user_name: `${r.ticketer.first_name} ${r.ticketer.last_name}`.trim(),
          pos_session_id: r.pos_device.device.name,
          location_id: r.location.name,
          opening_balance: r.opening_balance,
          closing_balance: r.closing_balance,
          total_sold: r.total_sold,
          top_up: topUp,
          submitted_at: r.submitted_at.toISOString(),
          report_date: r.report_date.toISOString(),
          status: r.status
        };
      })
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
        where: { pos_session_id: posSessionId, company_id, status: { notIn: ["CANCELLED", "REJECTED"] } }
      });
      if (existingReport) throw new ApiError(400, "Report already submitted for this session");

      // 1. Verify caller has permission to submit for this ticketer
      if (callerRole === "SUPERVISOR") {
        const targetUser = await tx.user.findFirst({
          where: { id: ticketerId, company_id, supervisor_id: callerId }
        });
        if (!targetUser) {
          throw new ApiError(403, "You can only submit reports for ticketers you supervise");
        }
      }

      // 2. Session Status Guard (Only allow active sessions to be reported)
      if (sessionRecord.status !== "ACTIVE") {
        throw new ApiError(400, "POS session must be active to submit a sales report");
      }

      // 3. Opening Balance Guard (Verify reported opening balance matches DB session float)
      if (openVal !== Number(sessionRecord.pos_float)) {
        throw new ApiError(
          400,
          `Opening balance (${openVal}) does not match the session's assigned float (${sessionRecord.pos_float})`
        );
      }

      // 4. Mathematical Reconciliation Verification
      // Formula: Opening Balance = Total Sold (Sales) + Closing Balance
      // Note: Opening Balance (pos_float) already includes all top-ups
      const expectedTotal = openVal;
      const reportedTotal = soldVal + closeVal;

      if (expectedTotal !== reportedTotal) {
        throw new ApiError(
          400,
          `Reconciliation mismatch! (Opening Balance: ${openVal}) does not equal (Total Sold: ${soldVal} + Closing Balance: ${closeVal} = ${reportedTotal}). Please check your entries.`
        );
      }


      // Fetch location hours for due date calculation
      const location = await tx.location.findFirst({
        where: { id: locationId, company_id }
      });

      // 1. Resolve true operational date from POS Device Session assignment
      const sessionDate = new Date(sessionRecord.assigned_at);
      const reportDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

      // 2. Calculate due date: 24h from operational closing hours of the session assignment day
      const closingDateTime = new Date(sessionDate);
      if (location?.closing_time) {
        const [hours, minutes] = location.closing_time.split(":").map(Number);
        closingDateTime.setHours(hours, minutes, 0, 0);
      } else {
        // Fallback: 6:00 PM on assignment day
        closingDateTime.setHours(18, 0, 0, 0);
      }
      const dueDate = new Date(closingDateTime.getTime() + 24 * 60 * 60 * 1000);

      // 3. Create Sales Report anchored to the session assignment date
      const newReport = await tx.salesReport.create({
        data: {
          company_id,
          ticketer_id: ticketerId,
          pos_session_id: posSessionId,
          location_id: locationId,
          opening_balance: openVal,
          closing_balance: closeVal,
          total_sold: soldVal,
          report_day: reportDay,
          report_date: sessionRecord.assigned_at,
          status: "PENDING"
        }
      });

      // Sum all remittances submitted for this session (both pending and confirmed)
      const remittances = await tx.remittance.aggregate({
        where: {
          company_id,
          status: { in: ["CONFIRMED", "PENDING", "ACCEPTED_BY_SUPERVISOR", "PENDING_SUPERVISOR_ACCEPTANCE"] },
          pos_session_id: posSessionId
        },
        _sum: { amount: true }
      });
      const totalRemitted = Number(remittances._sum.amount ?? 0);

      const expectedCash = openVal - closeVal; // equivalent to soldVal
      const shortageAmount = Math.max(0, expectedCash - totalRemitted);

      // 4. Determine status: if due date passed and cash is not fully remitted, mark as OVERDUE
      const now = new Date();
      let expectationStatus: "PAID" | "PENDING" | "OVERDUE" = "PENDING";
      if (totalRemitted >= expectedCash) {
        expectationStatus = "PAID";
      } else if (dueDate < now) {
        expectationStatus = "OVERDUE";
      }

      // Create or Update Remittance Expectation immediately on report submission
      const existingExpectation = await tx.remittanceExpectation.findUnique({
        where: { pos_session_id: posSessionId }
      });

      if (existingExpectation) {
        await tx.remittanceExpectation.update({
          where: { id: existingExpectation.id },
          data: {
            expected_amount: expectedCash,
            status: expectationStatus,
            shortage_amount: shortageAmount,
            due_date: dueDate
          }
        });
      } else {
        await tx.remittanceExpectation.create({
          data: {
            company_id,
            user_id: ticketerId,
            pos_session_id: posSessionId,
            expected_amount: expectedCash,
            due_date: dueDate,
            status: expectationStatus,
            shortage_amount: shortageAmount
          }
        });
      }

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

        const jobPayload = {
      event: "ON_REPORT_SUBMISSION",
      reportId: report.id, 
      companyId: company_id
    };

    if (rulesQueue) {
      await rulesQueue.add("evaluate-rules", jobPayload);
    } else {
      // Synchronous fallback
      await runRuleEvaluation(jobPayload);
    }

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error("POST /api/sales error:", error);
    return NextResponse.json({
      error: error instanceof ApiError ? error.message : "Internal Server Error"
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
