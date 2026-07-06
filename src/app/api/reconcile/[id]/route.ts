// src/app/api/reconcile/[id]/verify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: callerId, role, company_id } = session.user;

    // Only Admins or Auditors can verify reconciliation payments
    if (role !== "ADMIN" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Unauthorized to verify reconciliation payments" }, { status: 403 });
    }

    const paramsData = await params;
    const remittanceId = paramsData.id;

    const body = await req.json();
    const { action } = body; // "VERIFY" | "REJECT"

    if (!["VERIFY", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch remittance
      const remittance = await tx.remittance.findFirst({
        where: { id: remittanceId, company_id },
        include: { pos_session: true }
      });

      if (!remittance) {
        throw new ApiError(404, "Remittance not found");
      }
      // Guard: Cash remittances must be DEPOSITED; Transfers must be PENDING
      if (remittance.method === "CASH" && !["DEPOSITED"].includes(remittance.status)) {
        throw new ApiError(400, "Cash remittance must be deposited into the bank by the supervisor before Admin verification.");
      }
      if (remittance.method === "TRANSFER" && remittance.status !== "PENDING") {
        throw new ApiError(400, "Remittance has already been processed or is not ready for verification.");
      }

      // Ensure this is a reconciliation remittance (pos_session has status CLOSED or RETURNED)
      if (!remittance.pos_session_id || !remittance.pos_session || !["CLOSED", "RETURNED"].includes(remittance.pos_session.status)) {
        throw new ApiError(400, "This remittance is not linked to a closed session shortage");
      }

      // 2. Fetch target expectation
      const expectation = await tx.remittanceExpectation.findFirst({
        where: { pos_session_id: remittance.pos_session_id, company_id }
      });

      if (!expectation) {
        throw new ApiError(404, "Remittance expectation not found for this closed session");
      }

      const paidAmount = Number(remittance.amount);

      if (action === "REJECT") {
        const rejectedRemittance = await tx.remittance.update({
          where: { id: remittanceId },
          data: {
            status: "REJECTED",
            verified_by: callerId,
            verified_at: new Date()
          }
        });
        return { remittance: rejectedRemittance };
      }

      // Action is VERIFY
      // A) Update remittance status
      const confirmedRemittance = await tx.remittance.update({
        where: { id: remittanceId },
        data: {
          status: "CONFIRMED",
          verified_by: callerId,
          verified_at: new Date()
        }
      });

            // B) Update ticketer's expectation
      const confirmedAgg = await tx.remittance.aggregate({
        where: {
          company_id,
          pos_session_id: expectation.pos_session_id,
          status: "CONFIRMED"
        },
        _sum: { amount: true }
      });
      const totalConfirmed = Number(confirmedAgg._sum.amount ?? 0);
      const remainingOwed = Math.max(0, Number(expectation.expected_amount) - totalConfirmed);
      const isPaid = remainingOwed <= 0;

      await tx.remittanceExpectation.update({
        where: { id: expectation.id },
        data: {
          shortage_amount: remainingOwed,
          status: isPaid ? "PAID" : expectation.status
        }
      });


      // C) Financial ledger entries (Credit Company Account & Ticketer Account)
      await tx.float_Ledger.create({
        data: {
          company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount: remittance.amount,
          entry_type: "CREDIT",
          reference_type: "REMITTANCE",
          reference_id: remittance.id,
          description: `Reconciliation remittance verified in Bank (${remittance.method})`,
        }
      });

      const sender = await tx.user.findUnique({
        where: { id: remittance.submitted_by },
        select: { role: true }
      });
      const accountType = sender?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER";
      await tx.float_Ledger.create({
        data: {
          company_id,
          account_id: remittance.submitted_by,
          account_type: accountType,
          amount: remittance.amount,
          entry_type: "CREDIT",
          reference_type: "REMITTANCE",
          reference_id: remittance.id,
          description: `Reconciliation remittance verified. Shortage reduced.`,
        }
      });
      // D) Increment Company Float available balance
      await tx.companyFloat.upsert({
        where: { id: "COMPANY_ACCOUNT", company_id },
        update: { available_balance: { increment: remittance.amount } },
        create: { id: "COMPANY_ACCOUNT", company_id, available_balance: remittance.amount }
      });


      return { remittance: confirmedRemittance };
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("PATCH /api/reconcile/[id]/verify error:", error);
    return NextResponse.json({
      error: error instanceof ApiError ? error.message : "Internal Server Error"
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
