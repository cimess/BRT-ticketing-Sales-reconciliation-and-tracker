// src/app/api/sales/[id]/cancel/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user || !session.user.id ||session.user.role !== "TICKETER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: callerId, company_id: companyId } = session.user;
    const { id: reportId } = params;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Sales Report
      const report = await tx.salesReport.findFirst({
        where: { id: reportId, company_id: companyId }
      });
      if (!report) throw new ApiError(404, "Sales report not found");

      // 2. Security Check: Ticketers can only cancel their own reports
      if (report.ticketer_id !== callerId) {
        throw new ApiError(403, "You can only cancel your own sales reports");
      }

      // 3. Condition Check: Can only cancel PENDING reports
      if (report.status !== "PENDING") {
        throw new ApiError(400, `Cannot cancel report with status '${report.status}'`);
      }

      // 4. Strict Day Check: Ticketers cannot cancel reports from previous days
      const reportDate = new Date(report.report_date);
      const today = new Date();
      const isSameDay =
        reportDate.getFullYear() === today.getFullYear() &&
        reportDate.getMonth() === today.getMonth() &&
        reportDate.getDate() === today.getDate();

      if (!isSameDay) {
        throw new ApiError(400, "Security Violation: You cannot cancel sales reports from previous days.");
      }

      // 5. Session Status Check: Cannot cancel if the POS session is already closed/returned
      const sessionRecord = await tx.posDeviceSession.findFirst({
        where: { id: report.pos_session_id, company_id: companyId }
      });
      if (!sessionRecord || sessionRecord.status === "RETURNED") {
        throw new ApiError(400, "Cannot cancel report for a closed/returned POS session");
      }

      // 6. Mark report as CANCELLED
      const cancelledReport = await tx.salesReport.update({
        where: { id: reportId },
        data: {
          status: "CANCELLED"
        }
      });

      // 7. Log Audit Trail
      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: callerId,
          action: "UPDATE",
          entity_type: "SALES_REPORT",
          entity_id: report.id,
          after_state: cancelledReport as unknown as Prisma.InputJsonValue
        }
      });

      return cancelledReport;
    });

    return NextResponse.json({ success: true, report: result });
  } catch (error) {
    console.error("POST /api/sales/cancel error:", error);
    return NextResponse.json({ 
      error: error instanceof ApiError ? error.message : "Internal Server Error" 
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
