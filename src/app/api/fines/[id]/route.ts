// Proposed update for src/app/api/fines/[id]/route.ts

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/app/lib/ApiError";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Fix: TypeScript parameters promise
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: callerId, role, company_id } = session.user;
    const { id: fineId } = await params;

    const body = await req.json();
    const { action, amount } = body; // "DECLARE_PAID", "VERIFY_PAYMENT", "VOID", or "UPDATE_AMOUNT"

    if (!["DECLARE_PAID", "VERIFY_PAYMENT", "VOID", "UPDATE_AMOUNT","REVERSE"].includes(action)) {
      return NextResponse.json({ 
        error: "Invalid action. DECLARE_PAID, VERIFY_PAYMENT, VOID, or UPDATE_AMOUNT allowed." 
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fine = await tx.fine.findUnique({
        where: { id: fineId, company_id }
      });

      if (!fine) throw new ApiError(404, "Fine not found");
      
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
            description: `Fine payment verified for Defaulter ID ${fine.defaulter_id}`,
          }
        });

        await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id },
          update: { available_balance: { increment: Number(fine.amount) } },
          create: { id: "COMPANY_ACCOUNT", company_id, available_balance: Number(fine.amount) }
        });

        const defaulterUser = await tx.user.findUnique({
          where: { id: fine.defaulter_id },
          select: { role: true }
        });
        const accountType = defaulterUser?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER";

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
      }      // 5. Reversing a paid fine back to UNPAID (called by ADMIN)
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
            description: `Fine payment reversed for Defaulter ID ${fine.defaulter_id}`,
          }
        });

        await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id },
          update: { available_balance: { decrement: Number(fine.amount) } },
          create: { id: "COMPANY_ACCOUNT", company_id, available_balance: -Number(fine.amount) }
        });

        const defaulterUser = await tx.user.findUnique({
          where: { id: fine.defaulter_id },
          select: { role: true }
        });
        const accountType = defaulterUser?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER";

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

    return NextResponse.json({ success: true, fine: result });
  } catch (error) {
    console.error("PATCH /api/fines/[id] error:", error);
    return NextResponse.json({
      error: error instanceof ApiError ? error.message : "Internal Server Error"
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
