// src/app/api/remitance/[id]/verify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let remittanceId = "unknown";

  try {
    const session = await auth();
    if (!session?.user || !session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: userId, role, company_id } = session.user;

    if (role !== "ADMIN" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Unauthorized to verify remittances" }, { status: 403 });
    }

    const paramsData = await params;
    remittanceId = paramsData.id;

    const body = await req.json();
    const { status } = body;

    if (!["CONFIRMED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const remittance = await tx.remittance.findUnique({ where: { id: remittanceId, company_id } });

      if (!remittance) throw new ApiError(404, "Remittance not found");

      // Strict Guard: Admin can ONLY verify items that have reached DEPOSITED state (for cash) or PENDING (for transfers)
      if (remittance.method === "CASH" && remittance.status !== "DEPOSITED") {
        throw new ApiError(
          400,
          "Cannot verify cash remittance. The supervisor must deposit the cash into the bank first."
        );
      }

      if (remittance.method === "TRANSFER" && remittance.status !== "PENDING") {
        throw new ApiError(400, "Transfer remittance is already processed or invalid.");
      }
        if (remittance.pos_session_id) {
        const expectation = await tx.remittanceExpectation.findUnique({
          where: { pos_session_id: remittance.pos_session_id }
        });
        if (expectation && ["OVERDUE", "VIOLATED"].includes(expectation.status)) {
          throw new ApiError(
            400,
            "This payment is for an overdue/violated shortage and must be verified through the Reconciliation Page."
          );
        }
      }

      // 1. Update Remittance Status
      const updatedRemittance = await tx.remittance.update({
        where: { id: remittanceId, company_id },
        data: {
          status: status,
          verified_by: userId,
          verified_at: new Date()
        }
      });

           // 2. If CONFIRMED, execute financial movements (Money is verified in Company Bank)
      if (status === "CONFIRMED") {
        // Record credit to Company Account ledger
        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount: remittance.amount,
            entry_type: "CREDIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: remittance.method === "CASH" 
              ? `Supervisor bank deposit verified by Admin`
              : `Direct bank transfer verified by Admin`,
          }
        });

        // Increment available balance in Company Float
        await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id },
          update: { available_balance: { increment: remittance.amount } },
          create: { id: "COMPANY_ACCOUNT", company_id, available_balance: remittance.amount }
        });


        const sender = await tx.user.findUnique({ where: { id: remittance.submitted_by, company_id } });

        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: remittance.submitted_by,
            account_type: sender?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER",
            amount: remittance.amount,
            entry_type: "CREDIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Remittance verified. Debt reduced.`,
          }
        });

        const paidAmount = Number(remittance.amount);

        if (sender?.role === "TICKETER" && remittance.pos_session_id) {
          const expectation = await tx.remittanceExpectation.findUnique({
            where: { pos_session_id: remittance.pos_session_id }
          });

          if (expectation) {
            const confirmedRemittances = await tx.remittance.aggregate({
              where: {
                company_id,
                pos_session_id: remittance.pos_session_id,
                status: "CONFIRMED"
              },
              _sum: { amount: true }
            });
            const totalRemitted = Number(confirmedRemittances._sum.amount ?? 0);
            const remainingOwed = Math.max(0, expectation.expected_amount - totalRemitted);

            await tx.remittanceExpectation.update({
              where: { id: expectation.id },
              data: {
                status: remainingOwed <= 0 ? "PAID" : "SUBMITTED",
                shortage_amount: remainingOwed,
              }
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          company_id,
          user_id: userId,
          action: "VERIFY",
          entity_type: "REMITTANCE",
          entity_id: remittanceId,
          before_state: JSON.stringify(remittance),
          after_state: JSON.stringify(updatedRemittance),
        }
      });

      return updatedRemittance;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(`PATCH /api/remitance/${remittanceId}/verify error:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
