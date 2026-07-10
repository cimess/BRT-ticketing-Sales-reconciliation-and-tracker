// src/app/api/sales/[id]/verify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { PosDeviceSession, Prisma } from "@prisma/client";
import { sendNotification } from "@/app/server/services/notification.service";
import { cacheInvalidate } from "@/app/lib/redis";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
            // Send Notification to ticketer
      await sendNotification({
        companyId: companyId,
        message: `Your sales report has been rejected by the supervisor: ${rejectionReason || "No reason specified"}.`,
        type: "SALE_REJECTED",
        referenceId: reportId,
        target: {
          userIds: [rejectedReport.ticketer_id],
          roles: ["ADMIN"],
          excludeUserId: verifierId,
        }
      });

      return NextResponse.json({ success: true, report: rejectedReport });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch Sales Report & Session details
      const report = await tx.salesReport.findFirst({
        where: { id: reportId, company_id: companyId },
        include: { pos_device: true , ticketer: true,location:true}
      });
      if (!report) throw new ApiError(404, "Sales report not found");
      if (report.status !== "PENDING") throw new ApiError(400, "Report has already been processed");

         // Expected Cash collected during this shift (which is the sales amount)
      // Note: opening_balance already includes all top-ups
      const expectedCash = report.opening_balance - report.closing_balance;

      const remittances = await tx.remittance.aggregate({
        where: { 
          company_id: companyId,
          status: "CONFIRMED",
          pos_session_id: report.pos_session_id
        },
        _sum: { amount: true }
      });
      const totalConfirmed = Number(remittances._sum.amount ?? 0);

      const shortageAmount = Math.max(0, expectedCash - totalConfirmed);

      // 4. Update or Create Remittance Expectation
      const expectation = await tx.remittanceExpectation.findUnique({
        where: { pos_session_id: report.pos_session_id }
      });

      if (expectation) {
        let targetStatus: "PAID" | "PENDING" | "OVERDUE" | "SUBMITTED" | "VIOLATED" = "PENDING";
        if (totalConfirmed >= expectedCash) {
          targetStatus = "PAID";
        } else {
          const pendingCount = await tx.remittance.count({
            where: {
              company_id: companyId,
              pos_session_id: report.pos_session_id,
              status: { in: ["PENDING", "PENDING_SUPERVISOR_ACCEPTANCE", "ACCEPTED_BY_SUPERVISOR", "DEPOSITED"] }
            }
          });
          if (pendingCount > 0) {
            targetStatus = "SUBMITTED";
          } else {
            const now = new Date();
            targetStatus = expectation.due_date < now 
              ? (["OVERDUE", "VIOLATED"].includes(expectation.status) ? (expectation.status ) : "OVERDUE")
              : "PENDING";
          }
        }

        await tx.remittanceExpectation.update({
          where: { id: expectation.id },
          data: {
            expected_amount: expectedCash,
            status: targetStatus,
            shortage_amount: shortageAmount
          }
        });
      } else {
        // Fallback: closing session date plus 24 hours
        const closingDateTime = new Date(report.report_date);
        if (report.location?.closing_time) {
          const [hours, minutes] = report.location.closing_time.split(":").map(Number);
          closingDateTime.setHours(hours, minutes, 0, 0);
        } else {
          closingDateTime.setHours(18, 0, 0, 0);
        }
        const dueDate = new Date(closingDateTime.getTime() + 24 * 60 * 60 * 1000);

        let targetStatus: "PAID" | "PENDING" | "OVERDUE" | "SUBMITTED" = "PENDING";
        if (totalConfirmed >= expectedCash) {
          targetStatus = "PAID";
        } else {
          const pendingCount = await tx.remittance.count({
            where: {
              company_id: companyId,
              pos_session_id: report.pos_session_id,
              status: { in: ["PENDING", "PENDING_SUPERVISOR_ACCEPTANCE", "ACCEPTED_BY_SUPERVISOR", "DEPOSITED"] }
            }
          });
          if (pendingCount > 0) {
            targetStatus = "SUBMITTED";
          } else if (dueDate < new Date()) {
            targetStatus = "OVERDUE";
          }
        }

        await tx.remittanceExpectation.create({
          data: {
            company_id: companyId,
            user_id: report.ticketer_id,
            pos_session_id: report.pos_session_id,
            expected_amount: expectedCash,
            due_date: dueDate,
            status: targetStatus,
            shortage_amount: shortageAmount
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

        // 💡 Create B's expectation with the handed-over opening float
        if (Number(report.closing_balance) > 0) {
          await tx.remittanceExpectation.create({
            data: {
              company_id: companyId,
              user_id: handoverToTicketerId,
              pos_session_id: newSession.id,
              expected_amount: Number(report.closing_balance),
              shortage_amount: Number(report.closing_balance),
              due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
              status: "PENDING",
            }
          });
        }


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
            pos_float: report.closing_balance, // Update pos_float to the remaining amount
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

          // 💡 Increment A's expectation by B's closing balance (handback)
          if (Number(report.closing_balance) > 0) {
            const existingExpectation = await tx.remittanceExpectation.findUnique({
              where: { pos_session_id: sharedSession.id }
            });
            if (existingExpectation) {
              await tx.remittanceExpectation.update({
                where: { id: existingExpectation.id },
                data: {
                  expected_amount: { increment: Number(report.closing_balance) },
                  shortage_amount: { increment: Number(report.closing_balance) }
                }
              });
            } else {
              await tx.remittanceExpectation.create({
                data: {
                  company_id: companyId,
                  user_id: sharedSession.user_id,
                  pos_session_id: sharedSession.id,
                  expected_amount: Number(report.closing_balance),
                  shortage_amount: Number(report.closing_balance),
                  due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  status: "PENDING",
                }
              });
            }
          }
        }
else {
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
     // Send Notification to ticketer
    await sendNotification({
      companyId: companyId,
      message: `Your sales report has been verified and approved.`,
      type: "SALE_VERIFIED",
      referenceId: result.report.id,
      target: {
        userIds: [result.report.ticketer_id],
        roles: ["ADMIN"],
        excludeUserId: verifierId,
      }
    });

     await cacheInvalidate(`cache:sales:${companyId}:*`);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("PUT /api/sales/verify error:", error);
    return NextResponse.json({ 
      error: error instanceof ApiError ? error.message : "Internal Server Error" 
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
