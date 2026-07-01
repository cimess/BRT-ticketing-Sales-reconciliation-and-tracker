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
    const { id: reportId } = await params;

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

         // Expected Cash collected during this shift (which is the sales amount)
      // Note: opening_balance already includes all top-ups
      const expectedCash = report.opening_balance - report.closing_balance;


     // Sum all remittances submitted for this session (both pending and confirmed)
      const remittances = await tx.remittance.aggregate({
        where: { 
          company_id: companyId,
          status: { in: ["CONFIRMED", "PENDING"] },
          pos_session_id: report.pos_session_id
        },
        _sum: { amount: true }
      });
      const totalRemitted = Number(remittances._sum.amount ?? 0);

            // 4. Update or Create Remittance Expectation
      const expectation = await tx.remittanceExpectation.findUnique({
        where: { pos_session_id: report.pos_session_id }
      });

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
            pos_session_id: report.pos_session_id,
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
      }else {
        // --- NORMAL SHIFT CLOSE / HANDBACK FLOW (B -> A or standard return) --
        // 1. Transition the current session status to a closed state (RETURNED)
        await tx.posDeviceSession.update({
          where: { id: report.pos_session_id },
          data: {
            status: "CLOSED",
            unassigned_at: new Date(),
            unassigned_by: verifierId,
            unassigned_reason: "Shift closed and sales verified"
          }
        });

        // 2. Check if there is a previous SHARED session on this device (A's suspended session)
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
        } else {
          // 3. Standard return: set physical device status to INACTIVE so it can be re-assigned
          await tx.pos_devices.update({
            where: { id: report.pos_device.device_id },
            data: { status: "INACTIVE" }
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
