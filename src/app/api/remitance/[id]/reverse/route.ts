// src/app/api/remitance/[id]/reverse/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { sendNotification } from "@/app/server/services/notification.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const role = session.user.role;
    const companyId = session.user.company_id;

    if (role !== "ADMIN" && role !== "AUDITOR" && role !== "TICKETER"&& role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: remittanceId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const remittance = await tx.remittance.findUnique({ where: { id: remittanceId,company_id:companyId } });
      if (!remittance) throw new ApiError(404, "Remittance not found");

      // --- TICKETER CANCELLATION LOGIC ---
      if (role === "TICKETER" || role === "SUPERVISOR") {
        if (remittance.submitted_by !== userId) throw new ApiError(401, "You can only cancel your own remittance.");
        if (!["PENDING", "PENDING_SUPERVISOR_ACCEPTANCE", "DEPOSITED"].includes(remittance.status)) {
          throw new ApiError(400, "You cannot cancel a remittance that has already been processed or accepted.");
        }
        
        const cancelled = await tx.remittance.update({
          where: { id: remittanceId,company_id:companyId},
          data: { status: "CANCELLED" }
        });

               // Restore expectation status dynamically when cancellation happens
               let expectation = null;
        if (remittance.pos_session_id) {
          expectation = await tx.remittanceExpectation.findUnique({
            where: { pos_session_id: remittance.pos_session_id, company_id: companyId }
          });
        } else {
          expectation = await tx.remittanceExpectation.findFirst({
            where: {
              user_id: remittance.submitted_by,
              pos_session_id: null,
              status: { in: ["PENDING", "OVERDUE", "VIOLATED", "SUBMITTED"] },
              company_id: companyId,
            },
            orderBy: { created_at: "asc" }
          });
        }

        if (expectation) {
          const pendingCount = await tx.remittance.count({
            where: {
              pos_session_id: remittance.pos_session_id,
              submitted_by: remittance.submitted_by,
              id: { not: remittanceId },
              status: { in: ["PENDING", "PENDING_SUPERVISOR_ACCEPTANCE", "DEPOSITED"] },
              company_id: companyId,
            }
          });

          const now = new Date();
          const restoredStatus = pendingCount > 0 
            ? (expectation.due_date < now ? "OVERDUE" : "SUBMITTED") 
            : (expectation.due_date < now ? "OVERDUE" : "PENDING");

          await tx.remittanceExpectation.update({
            where: { id: expectation.id, company_id: companyId },
            data: { status: restoredStatus }
          });
        }



        await tx.auditLog.create({
          data: { user_id: userId, action: "CANCELLED", entity_type: "REMITTANCE", entity_id: remittanceId, before_state: remittance, after_state: cancelled,company_id:companyId }
        });

        return cancelled;
      }


      // --- ADMIN REVERSAL LOGIC ---
      if (remittance.status !== "CONFIRMED" && remittance.status !== "REJECTED") {
        throw new ApiError(400, "Remittance is already pending or cancelled and cannot be reversed by Admin.");
      }

      const previousStatus = remittance.status;

            // Determine restored status based on remittance method
      const restoredStatus = remittance.method === "CASH" ? "DEPOSITED" : "PENDING";

      const updatedRemittance = await tx.remittance.update({
        where: { id: remittanceId, company_id: companyId },
        data: { status: restoredStatus, verified_by: null, verified_at: null }
      });

      if (previousStatus === "CONFIRMED") {
        // A) Rollback the CREDIT on Company Account
        await tx.float_Ledger.create({
          data: {
            company_id: companyId,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount: remittance.amount,
            entry_type: "DEBIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Reversal of Remittance ${remittance.method}`,
          },
        });

        // B) Decrement CompanyFloat balance
        await tx.companyFloat.update({
          where: { id: "COMPANY_ACCOUNT", company_id: companyId },
          data: { available_balance: { decrement: remittance.amount } },
        });


     const sender = await tx.user.findUnique({
          where: { id: remittance.submitted_by },
          select: { role: true }
        });
        const accountType = sender?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER";
        await tx.float_Ledger.create({
          data: {
            company_id: companyId,
            account_id: remittance.submitted_by,
            account_type: accountType,
            amount: remittance.amount,
            entry_type: "DEBIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Reversal of Remittance. Debt restored.`,
          },
        });

             // D) Revert expectation status dynamically when reversal happens
               let expectation = null;
        if (remittance.pos_session_id) {
          expectation = await tx.remittanceExpectation.findUnique({
            where: { pos_session_id: remittance.pos_session_id, company_id: companyId }
          });
        } else {
          expectation = await tx.remittanceExpectation.findFirst({
            where: {
              user_id: remittance.submitted_by,
              pos_session_id: null,
              company_id: companyId,
              status: { in: ["PAID", "PENDING", "OVERDUE", "VIOLATED", "SUBMITTED"] }
            },
            orderBy: { created_at: "asc" }
          });
        }

        if (expectation) {
          const restoredShortage = Number(expectation.shortage_amount) + Number(remittance.amount);
          const now = new Date();
          const restoredStatus = expectation.due_date < now ? "OVERDUE" : "PENDING";

          await tx.remittanceExpectation.update({
            where: { id: expectation.id },
            data: { 
              status: restoredStatus,
              shortage_amount: restoredShortage
            }
          });
        }



      await tx.auditLog.create({
        data: { 
          company_id:companyId,
          user_id: userId, 
          action: "REVERSE", 
          entity_type: "REMITTANCE", 
          entity_id: remittanceId, 
          before_state: remittance, 
          after_state: updatedRemittance
        }
      });

      return updatedRemittance;
    }
  });

    // Send Notification
  if (result) {
    if (role === "TICKETER" || role === "SUPERVISOR") {
      await sendNotification({
        companyId: companyId,
        message: `${session.user.name || "User"} cancelled a pending remittance of ₦${Number(result.amount).toLocaleString()}.`,
        type: "REMITTANCE_CANCELLED",
        referenceId: remittanceId,
        target: {
          roles: ["ADMIN"],
          excludeUserId: userId,
        }
      });
    } else {
      await sendNotification({
        companyId: companyId,
        message: `Your remittance of ₦${Number(result.amount).toLocaleString()} has been reversed by the administrator.`,
        type: "REMITTANCE_REVERSED",
        referenceId: remittanceId,
        target: {
          userIds: [result.submitted_by],
          roles: ["ADMIN"],
          excludeUserId: userId,
        }
      });
    }
  }


    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(`PATCH /api/remitance/${params.id}/reverse error:`, error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error:"Internal Server Error" }, { status: 500 });
  }
}
