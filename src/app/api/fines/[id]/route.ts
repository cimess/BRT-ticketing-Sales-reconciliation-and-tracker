// src/app/api/fines/[id]/route.ts

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/app/lib/ApiError";
import { checkSupervisorFinePermission } from "@/app/server/services/rules.service";
import { Roles } from "@prisma/client";
import { sendNotification } from "@/app/server/services/notification.service";
import { cacheInvalidate } from "@/app/lib/redis";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: callerId, role, company_id } = session.user;
    const { id: fineId } = await params;

    const body = await req.json();
    const { action, amount } = body; // "DECLARE_PAID", "VERIFY_PAYMENT", "VOID", "UPDATE_AMOUNT", or "REVERSE"

    if (!["DECLARE_PAID", "VERIFY_PAYMENT", "VOID", "UPDATE_AMOUNT", "REVERSE"].includes(action)) {
      return NextResponse.json({ 
        error: "Invalid action. DECLARE_PAID, VERIFY_PAYMENT, VOID, UPDATE_AMOUNT, or REVERSE allowed." 
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fine = await tx.fine.findUnique({
        where: { id: fineId, company_id },
        include: {
          defaulter: {
            select: { role: true, first_name: true, last_name: true }
          }
        }
      });

      if (!fine) throw new ApiError(404, "Fine not found");

      // Gating rule check for Supervisors
      if (role === "SUPERVISOR") {
        const hasPermission = await checkSupervisorFinePermission(company_id);
        if (!hasPermission) {
          throw new ApiError(403, "Forbidden: Supervisors do not have permission to edit or waive fines");
        }
      }
      
      const defaulterName = fine.defaulter
        ? `${fine.defaulter.first_name} ${fine.defaulter.last_name}`
        : "Defaulter";

      let updatedFine;

      // 1. Offender declares that they have settled the fine
      if (action === "DECLARE_PAID") {
        if (fine.status !== "UNPAID") {
          throw new ApiError(400, `Fine is already ${fine.status}`);
        }
        if (fine.defaulter_id !== callerId) {
          throw new ApiError(403, "You can only declare your own fines as paid");
        }
        if (fine.amount === null) {
          throw new ApiError(400, "Fine amount must be set before declaring payment");
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { status: "PENDING" } // Moves to PENDING verification
        });
      }
      
      // 2. Admin verifies the payment request and logs it to financial ledgers
      else if (action === "VERIFY_PAYMENT") {
        if (role !== "ADMIN") {
          throw new ApiError(403, "Only admins can verify fine payments");
        }
        if (fine.status !== "PENDING") {
          throw new ApiError(400, `Only pending fines can be verified. Current status is ${fine.status}`);
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { status: "PAID" }
        });

        // Credit company balance and ticketer/supervisor ledger
        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount: Number(fine.amount),
            entry_type: "CREDIT",
            reference_type: "FINE_PAYMENT",
            reference_id: fine.id,
            description: `Fine payment verified for ${defaulterName}`,
          }
        });

        await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id },
          update: { available_balance: { increment: Number(fine.amount) } },
          create: { id: "COMPANY_ACCOUNT", company_id, available_balance: Number(fine.amount) }
        });

        const accountType = fine.defaulter?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER";

        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: fine.defaulter_id,
            account_type: accountType,
            amount: Number(fine.amount),
            entry_type: "CREDIT",
            reference_type: "FINE_PAYMENT",
            reference_id: fine.id,
            description: `Fine payment confirmed by admin. Debt reduced.`,
          }
        });
      } 
      
      // 3. Waiving the fine
      else if (action === "VOID") {
        if (fine.status !== "UNPAID" && fine.status !== "PENDING") {
          throw new ApiError(400, `Cannot waive a fine that is already ${fine.status}`);
        }
        if (role !== "ADMIN" && fine.issued_by !== callerId) {
          throw new ApiError(403, "Only admins or issuing supervisors can waive this fine");
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { status: "WAIVED" }
        });
      } 
      
      // 4. Update Fine Amount
      else if (action === "UPDATE_AMOUNT") {
        if (fine.status !== "UNPAID") {
          throw new ApiError(400, `Cannot update amount of a fine that is ${fine.status}`);
        }
        if (role !== "ADMIN" && role !== "SUPERVISOR") {
          throw new ApiError(403, "Only admins and supervisors can set fine amounts");
        }
        if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
          throw new ApiError(400, "Please specify a valid fine amount");
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { amount: Number(amount) }
        });
      }
      
      // 5. Reversing a paid fine back to UNPAID (called by ADMIN)
      else if (action === "REVERSE") {
        if (role !== "ADMIN") {
          throw new ApiError(403, "Only admins can reverse fine payments");
        }
        if (fine.status !== "PAID") {
          throw new ApiError(400, "Only paid fines can be reversed");
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { status: "UNPAID" }
        });

        // Debit the company float ledger entry (reversing credit)
        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount: Number(fine.amount),
            entry_type: "DEBIT", 
            reference_type: "FINE_PAYMENT_REVERSAL",
            reference_id: fine.id,
            description: `Fine payment reversed for ${defaulterName}`,
          }
        });

        await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id },
          update: { available_balance: { decrement: Number(fine.amount) } },
          create: { id: "COMPANY_ACCOUNT", company_id, available_balance: -Number(fine.amount) }
        });

        const accountType = fine.defaulter?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER";

        // Debit offender's ledger to restore the debt
        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: fine.defaulter_id,
            account_type: accountType,
            amount: Number(fine.amount),
            entry_type: "DEBIT", 
            reference_type: "FINE_PAYMENT_REVERSAL",
            reference_id: fine.id,
            description: `Fine payment reversed by admin. Debt restored.`,
          }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id,
          user_id: callerId,
          action: "UPDATE",
          entity_type: "FINE",
          entity_id: fine.id,
          before_state: fine,
          after_state: updatedFine
        }
      });

      return updatedFine;
    });

    // Send Notification
    if (result) {
      let notifyMessage = "";
      let targetUserIds: string[] = [];
      let targetRoles: Roles[] = [];
      
      const offenderName = result.defaulter_id === callerId 
        ? (session.user.name || "User") 
        : (result.defaulter?.first_name 
            ? `${result.defaulter.first_name} ${result.defaulter.last_name}` 
            : "User");
            
      const formattedAmount = result.amount ? Number(result.amount).toLocaleString() : "TBD";

      if (action === "DECLARE_PAID") {
        notifyMessage = `${offenderName} declared a fine of ₦${formattedAmount} as paid.`;
        targetRoles = ["ADMIN"];
      } else if (action === "VERIFY_PAYMENT") {
        notifyMessage = `Your fine payment of ₦${formattedAmount} has been verified and approved by the admin.`;
        targetUserIds = [result.defaulter_id];
      } else if (action === "VOID") {
        notifyMessage = `Your fine of ₦${formattedAmount} has been waived by the admin.`;
        targetUserIds = [result.defaulter_id];
      } else if (action === "REVERSE") {
        notifyMessage = `Your fine payment of ₦${formattedAmount} has been reversed by the admin.`;
        targetUserIds = [result.defaulter_id];
      }

      if (notifyMessage) {
        await sendNotification({
          companyId: company_id,
          message: notifyMessage,
          type: "FINE_ISSUED",
          referenceId: result.id,
          target: {
            userIds: targetUserIds.length > 0 ? targetUserIds : undefined,
            roles: targetRoles.length > 0 ? targetRoles : undefined,
          }
        });
      }
    }

    await cacheInvalidate(`cache:fines:${company_id}:*`);

    return NextResponse.json({ success: true, fine: result });
  } catch (error) {
    console.error("PATCH /api/fines/[id] error:", error);
    return NextResponse.json({
      error: error instanceof ApiError ? error.message : "Internal Server Error"
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
