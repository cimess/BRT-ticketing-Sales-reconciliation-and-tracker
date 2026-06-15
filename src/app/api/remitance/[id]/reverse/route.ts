// src/app/api/remitance/[id]/reverse/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { ApiError } from "@/lib/ApiError";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const role = session.user.role;

    if (role !== "ADMIN" && role !== "AUDITOR" && role !== "TICKETER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: remittanceId } = await params;

    const result = await prisma.$transaction(async (tx) => {
      const remittance = await tx.remittance.findUnique({ where: { id: remittanceId } });
      if (!remittance) throw new ApiError(404, "Remittance not found");

      // --- TICKETER CANCELLATION LOGIC ---
      if (role === "TICKETER") {
        if (remittance.submitted_by !== userId) throw new ApiError(401, "You can only cancel your own remittance.");
        if (remittance.status !== "PENDING") throw new ApiError(400, "You cannot cancel a remittance that has already been processed by an Admin.");
        
        const cancelled = await tx.remittance.update({
          where: { id: remittanceId },
          data: { status: "CANCELLED" }
        });

        await tx.auditLog.create({
          data: { user_id: userId, action: "CANCELLED", entity_type: "REMITTANCE", entity_id: remittanceId, before_state: remittance, after_state: cancelled }
        });

        return cancelled;
      }

      // --- ADMIN REVERSAL LOGIC ---
      if (remittance.status !== "CONFIRMED" && remittance.status !== "REJECTED") {
        throw new ApiError(400, "Remittance is already pending or cancelled and cannot be reversed by Admin.");
      }

      const previousStatus = remittance.status;

      const updatedRemittance = await tx.remittance.update({
        where: { id: remittanceId },
        data: { status: "PENDING", verified_by: null, verified_at: null }
      });

        if (previousStatus === "CONFIRMED") {
        // Check who originally received the cash
        const isSupervisorHoldingCash = remittance.received_by_supervisor_id !== null;
        const targetAccount = isSupervisorHoldingCash
          ? remittance.received_by_supervisor_id!
          : "COMPANY_ACCOUNT";
        const targetAccountType = isSupervisorHoldingCash ? "SUPERVISOR" : "COMPANY";

        // A) Rollback the CREDIT that was given to the receiver (Company OR Supervisor)
        await tx.float_Ledger.create({
          data: {
            account_id: targetAccount,
            account_type: targetAccountType,
            amount: remittance.amount,
            entry_type: "DEBIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Reversal of Remittance ${remittance.method}`,
          },
        });

        // B) Only decrement CompanyFloat if the Company originally got the money!
        if (!isSupervisorHoldingCash) {
          await tx.companyFloat.update({
            where: { id: "COMPANY_ACCOUNT" },
            data: { available_balance: { decrement: remittance.amount } },
          });
        }

        // C) Rollback Ticketer's Ledger — restore their debt
        await tx.float_Ledger.create({
          data: {
            account_id: remittance.submitted_by,
            account_type: "TICKETER",
            amount: remittance.amount,
            entry_type: "DEBIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Reversal of Remittance. Debt restored.`,
          },
        });

        // D) Revert expectations back to PENDING
        await tx.remittanceExpectation.updateMany({
          where: {
            ticketer_id: remittance.submitted_by,
            status: "PAID",
          },
          data: { status: "PENDING" },
        });
      }


      await tx.auditLog.create({
        data: { user_id: userId, action: "REVERSE", entity_type: "REMITTANCE", entity_id: remittanceId, before_state: remittance, after_state: updatedRemittance}
      });

      return updatedRemittance;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(`PATCH /api/remitance/${params.id}/reverse error:`, error);

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error:"Internal Server Error" }, { status: 500 });
  }
}
