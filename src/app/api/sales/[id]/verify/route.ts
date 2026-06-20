// src/app/api/sales/[id]/verify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { PosDeviceSession, Prisma } from "@prisma/client";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    // Allow Supervisors or Admins to verify
    if (!session?.user || !session.user.id || (session.user.role !== "ADMIN" && session.user.role !== "SUPERVISOR")) {
      return NextResponse.json({ error: "Unauthorized. Supervisor/Admin action only." }, { status: 401 });
    }
    const { id: verifierId, company_id: companyId } = session.user;
    const { id: reportId } = params;

    const body = await req.json();
    const { handoverToTicketerId, status, rejectionReason } = body; // status can be "VERIFIED" or "REJECTED"

    if (status === "REJECTED") {
      const rejectedReport = await prisma.salesReport.update({
        where: { id: reportId, company_id: companyId },
        data: {
          status: "REJECTED",
          verified_by: verifierId,
          verified_at: new Date(),
          rejection_reason: rejectionReason || "Rejected by supervisor"
        }
      });
      return NextResponse.json({ success: true, report: rejectedReport });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Sales Report & Session details
      const report = await tx.salesReport.findFirst({
        where: { id: reportId, company_id: companyId },
        include: { pos_device: true }
      });
      if (!report) throw new ApiError(404, "Sales report not found");
      if (report.status !== "PENDING") throw new ApiError(400, "Report has already been processed");

      // 2. Fetch original allocation (if B was assigned via standard allocation)
      const originalAllocation = await tx.float_allocations.findFirst({
        where: { pos_device_id: report.pos_session_id, company_id: companyId, status: "SUCCESS" },
        orderBy: { allocated_at: "asc" }
      });

      // Find all allocation IDs for this session to query remittances (including top-ups)
      const sessionAllocations = await tx.float_allocations.findMany({
        where: { pos_device_id: report.pos_session_id, company_id: companyId }
      });
      const allocationIds = sessionAllocations.map((a) => a.id);

      // 3. Compute top-ups
      let topupSum = 0;
      if (originalAllocation) {
        const topups = await tx.float_allocations.aggregate({
          where: { 
            pos_device_id: report.pos_session_id, 
            company_id: companyId, 
            status: "SUCCESS", 
            id: { not: originalAllocation.id } 
          },
          _sum: { amount_allocated: true }
        });
        topupSum = Number(topups._sum.amount_allocated ?? 0);
      } else {
        const topups = await tx.float_allocations.aggregate({
          where: { 
            pos_device_id: report.pos_session_id, 
            company_id: companyId, 
            status: "SUCCESS" 
          },
          _sum: { amount_allocated: true }
        });
        topupSum = Number(topups._sum.amount_allocated ?? 0);
      }

      // Expected Cash collected during this shift
      const expectedCash = (report.opening_balance - report.closing_balance) + topupSum;

      // Sum all remittances submitted for this session (both pending and confirmed)
      const remittances = await tx.remittance.aggregate({
        where: { 
          company_id: companyId,
          status: { in: ["CONFIRMED", "PENDING"] },
          OR: [
            { allocation_id: { in: allocationIds } },
            { submitted_by: report.ticketer_id, allocation_id: null }
          ]
        },
        _sum: { amount: true }
      });
      const totalRemitted = Number(remittances._sum.amount ?? 0);

      // 4. Update or Create Remittance Expectation
      let expectation = null;
      if (originalAllocation) {
        expectation = await tx.remittanceExpectation.findUnique({
          where: { allocation_id: originalAllocation.id }
        });
      } else {
        expectation = await tx.remittanceExpectation.findFirst({
          where: { user_id: report.ticketer_id, company_id: companyId, allocation_id: null },
          orderBy: { created_at: "desc" }
        });
      }

      if (expectation) {
        await tx.remittanceExpectation.update({
          where: { id: expectation.id },
          data: {
            expected_amount: expectedCash,
            status: totalRemitted >= expectedCash ? "PAID" : "PENDING",
            shortage_amount: Math.max(0, expectedCash - totalRemitted)
          }
        });
      } else {
        await tx.remittanceExpectation.create({
          data: {
            company_id: companyId,
            user_id: report.ticketer_id,
            expected_amount: expectedCash,
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: totalRemitted >= expectedCash ? "PAID" : "PENDING",
            shortage_amount: Math.max(0, expectedCash - totalRemitted)
          }
        });
      }

      let newSession: PosDeviceSession | undefined = undefined;
      let reactivatedSession: PosDeviceSession | null = null;

      if (handoverToTicketerId) {
        // --- HANDOVER FLOW (A -> B) ---
        // A's session status is set to SHARED (suspended)
        await tx.posDeviceSession.update({
          where: { id: report.pos_session_id },
          data: {
            status: "SHARED",
            unassigned_at: new Date(),
            unassigned_by: verifierId,
            unassigned_reason: `Shared/Handed over to ticketer ${handoverToTicketerId}`
          }
        });

        // Create B's new session with status = ACTIVE and opening float = A's closing balance
        newSession = await tx.posDeviceSession.create({
          data: {
            company_id: companyId,
            device_id: report.pos_device.device_id,
            user_id: handoverToTicketerId,
            pos_float: report.closing_balance,
            status: "ACTIVE",
            assigned_at: new Date(),
            assigned_by: verifierId
          }
        });

        // Set device status to ACTIVE under B's possession
        await tx.pos_devices.update({
          where: { id: report.pos_device.device_id },
          data: { status: "ACTIVE" }
        });
      } else {
        // --- NORMAL SHIFT CLOSE / HANDBACK FLOW (B -> A or standard return) --
        // Check if there is a previous SHARED session on this device (A's suspended session)
        const sharedSession = await tx.posDeviceSession.findFirst({
          where: {
            device_id: report.pos_device.device_id,
            status: "SHARED",
            company_id: companyId
          },
          orderBy: { assigned_at: "desc" }
        });

        if (sharedSession) {
          // Reactivate A's session back to ACTIVE and set opening float to B's closing balance
          reactivatedSession = await tx.posDeviceSession.update({
            where: { id: sharedSession.id },
            data: {
              status: "ACTIVE",
              pos_float: report.closing_balance,
              user_id: sharedSession.user_id,
              assigned_at: new Date(),
              assigned_by: verifierId
            }
          });
        }
      }

      // Mark report as verified
      const verifiedReport = await tx.salesReport.update({
        where: { id: reportId },
        data: {
          status: "VERIFIED",
          verified_by: verifierId,
          verified_at: new Date()
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id: companyId,
          user_id: verifierId,
          action: "VERIFY",
          entity_type: "SALES_REPORT",
          entity_id: report.id,
          after_state: verifiedReport as unknown as Prisma.InputJsonValue
        }
      });

      return { report: verifiedReport, newSession, reactivatedSession };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("PUT /api/sales/verify error:", error);
    return NextResponse.json({ 
      error: error instanceof ApiError ? error.message : "Internal Server Error" 
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
