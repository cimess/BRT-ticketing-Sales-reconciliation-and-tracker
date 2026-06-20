// src/app/api/sales/force-reconcile/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN"|| !session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Admin action only." }, { status: 401 });
    }
    const { id: adminId, company_id } = session.user;
    const body = await req.json();
    const { posSessionId, recoveredCash, finalPosFloat, locationId } = body;

    if (!posSessionId || recoveredCash === undefined || finalPosFloat === undefined || !locationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch active session
      const sessionRecord = await tx.posDeviceSession.findFirst({
        where: { id: posSessionId, company_id }
      });
      if (!sessionRecord) throw new ApiError(404, "POS session not found");
      if (sessionRecord.status !== "ACTIVE") throw new ApiError(400, "Session is already closed");

      // 2. Fetch target expectation
      const allocation = await tx.float_allocations.findFirst({
        where: { pos_device_id: posSessionId, company_id, status: "SUCCESS" },
        orderBy: { allocated_at: "desc" }
      });
      if (!allocation) throw new ApiError(404, "Allocation not found for session");

      const expectation = await tx.remittanceExpectation.findUnique({
        where: { allocation_id: allocation.id }
      });
      if (!expectation) throw new ApiError(404, "Remittance expectation not found");

      // 3. Calculate discrepancy
      const topups = await tx.float_allocations.aggregate({
        where: { pos_device_id: posSessionId, company_id, status: "SUCCESS", id: { not: allocation.id } },
        _sum: { amount_allocated: true }
      });
      const topupSum = Number(topups._sum.amount_allocated ?? 0);
      const expectedCash = (Number(sessionRecord.pos_float) - Number(finalPosFloat)) + topupSum;

      const remittances = await tx.remittance.aggregate({
        where: { allocation_id: allocation.id, status: "CONFIRMED" },
        _sum: { amount: true }
      });
      const actualRemitted = Number(remittances._sum.amount ?? 0);

      const discrepancy = expectedCash - (Number(recoveredCash) + actualRemitted);

      if (discrepancy > 0) {
        // Log fine to ticketer B
        await tx.fine.create({
          data: {
            company_id,
            defaulter_id: sessionRecord.user_id,
            amount: discrepancy,
            reason: `Force Release discrepancy. Expected Cash: ${expectedCash}, Recovered: ${recoveredCash}, Already Remitted: ${actualRemitted}.`,
            issued_by: adminId,
            status: "UNPAID"
          }
        });

        // Set expectation as violated
        await tx.remittanceExpectation.update({
          where: { id: expectation.id },
          data: {
            expected_amount: discrepancy,
            status: "VIOLATED",
            shortage_amount: discrepancy
          }
        });
      } else {
        // Mark expectation as fully paid
        await tx.remittanceExpectation.update({
          where: { id: expectation.id },
          data: {
            expected_amount: 0,
            status: "PAID",
            shortage_amount: 0
          }
        });
      }

      // 4. Create an artificial Sales Report to reconcile history
      const forceReport = await tx.salesReport.create({
        data: {
          company_id,
          ticketer_id: sessionRecord.user_id,
          pos_session_id: posSessionId,
          location_id: locationId,
          opening_balance: Number(sessionRecord.pos_float),
          closing_balance: Number(finalPosFloat),
          total_sold: Math.max(0, Number(sessionRecord.pos_float) - Number(finalPosFloat)),
          report_day: new Date(),
          report_date: new Date(),
          status: "VERIFIED",
          verified_by: adminId,
          verified_at: new Date()
        }
      });

      // 5. Force Close the session and return POS to pool
      await tx.posDeviceSession.update({
        where: { id: posSessionId },
        data: {
          status: "RETURNED",
          unassigned_at: new Date(),
          unassigned_by: adminId,
          unassigned_reason: "Admin force-reconciliation and release"
        }
      });

      await tx.pos_devices.update({
        where: { id: sessionRecord.device_id },
        data: { status: "INACTIVE" }
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: adminId,
          action: "UPDATE",
          entity_type: "SALES_REPORT",
          entity_id: posSessionId,
          after_state: { action: "FORCE_RELEASE", reportId: forceReport.id } as unknown as Prisma.InputJsonValue
        }
      });

      return { shortage: discrepancy > 0 ? discrepancy : 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/sales/force-reconcile error:", error);
    return NextResponse.json({ 
      error: error instanceof ApiError ? error.message : "Internal Server Error" 
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
