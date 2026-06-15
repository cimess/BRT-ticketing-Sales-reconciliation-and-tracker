// src/app/api/remitance/[id]/verify/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { ApiError } from "@/lib/ApiError";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let remittanceId = "unknown";

  try {
    const session = await auth();
    if (!session?.user||!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: userId, role } = session.user;

    // Only Admins (or authorized Supervisors) can verify
    if (role !== "ADMIN" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Unauthorized to verify remittances" }, { status: 403 });
    }

    // Await params safely (Next.js 15 requirement)
    const paramsData = await params;
    remittanceId = paramsData.id;
    
    const body = await req.json();
    const { status } = body; 

    if (!["CONFIRMED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const remittance = await tx.remittance.findUnique({ where: { id: remittanceId } });
      
      if (!remittance) throw new ApiError(404,"Remittance not found" );
      if (remittance.status !== "PENDING") throw new ApiError(400,"Remittance is already processed or cancelled" );

      // 1. Update Remittance Status
      const updatedRemittance = await tx.remittance.update({
        where: { id: remittanceId },
        data: {
          status: status,
          verified_by: userId,
          verified_at: new Date()
        }
      });

      // 2. If CONFIRMED, execute financial movements
      if (status === "CONFIRMED") {
        
        // Did the cash go to a Supervisor or to the Company?
        const isSupervisorHoldingCash = remittance.received_by_supervisor_id !== null;
        const targetAccount = isSupervisorHoldingCash ? remittance.received_by_supervisor_id : "COMPANY_ACCOUNT";
        const targetAccountType = isSupervisorHoldingCash ? "SUPERVISOR" : "COMPANY";

        // A) Credit the destination (Company OR Supervisor gets the money)
        await tx.float_Ledger.create({
          data: {
            account_id: targetAccount!,
            account_type: targetAccountType,
            amount: remittance.amount,
            entry_type: "CREDIT",
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: isSupervisorHoldingCash ? `Cash received by Supervisor` : `Remittance received via ${remittance.method}`,
          }
        });

        // B) Only update CompanyFloat if the Company actually got the money!
        if (!isSupervisorHoldingCash) {
          await tx.companyFloat.upsert({
            where: { id: "COMPANY_ACCOUNT" },
            update: { available_balance: { increment: remittance.amount } },
            create: { id: "COMPANY_ACCOUNT", available_balance: remittance.amount }
          });
        }

        // C) Clear the sender's debt! (Find out if sender was a Ticketer or Supervisor)
        const sender = await tx.user.findUnique({ where: { id: remittance.submitted_by } });
        
        await tx.float_Ledger.create({
          data: {
            account_id: remittance.submitted_by, 
            account_type: sender?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER",
            amount: remittance.amount,
            entry_type: "CREDIT", // A payment reduces liability
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Remittance verified. Debt reduced.`,
          }
        });

        // D) Mark Ticketer expectations as PAID (if sender was a ticketer)
        if (sender?.role === "TICKETER") {
          await tx.remittanceExpectation.updateMany({
            where: {
              ticketer_id: remittance.submitted_by,
              status: { in: ["PENDING", "OVERDUE"] }
            },
            data: { status: "PAID" }
          });
        }
      }

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
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
    return NextResponse.json({ error:"Internal Server Error" }, { status: 500 });
  }
}
