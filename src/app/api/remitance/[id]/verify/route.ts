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

    const { id: userId, role,company_id} = session.user;

    // Only Admins (or authorized Auditors) can verify
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
      const remittance = await tx.remittance.findUnique({ where: { id: remittanceId ,company_id} });

      if (!remittance) throw new ApiError(404, "Remittance not found");
      if (remittance.status !== "PENDING") throw new ApiError(400, "Remittance is already processed or cancelled");

      // 1. Update Remittance Status
      const updatedRemittance = await tx.remittance.update({
        where: { id: remittanceId ,company_id},
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
        const targetEntryType = isSupervisorHoldingCash ? "DEBIT" : "CREDIT";

        // A) Record movement on the destination account
        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: targetAccount!,
            account_type: targetAccountType,
            amount: remittance.amount,
            entry_type: targetEntryType, // DEBIT if Supervisor (holding cash increases liability), CREDIT if Company
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: isSupervisorHoldingCash
              ? `Cash collected by Supervisor from Ticketer`
              : `Remittance received via ${remittance.method}`,
          }
        });

        // B) Only update CompanyFloat if the Company actually got the money!
        if (!isSupervisorHoldingCash) {
          await tx.companyFloat.upsert({
            where: { id: "COMPANY_ACCOUNT",company_id },
            update: { available_balance: { increment: remittance.amount } },
            create: { id: "COMPANY_ACCOUNT",company_id, available_balance: remittance.amount }
          });
        }

        // C) Clear the sender's debt! (Find out if sender was a Ticketer or Supervisor)
        const sender = await tx.user.findUnique({ where: { id: remittance.submitted_by,company_id } });

        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: remittance.submitted_by,
            account_type: sender?.role === "SUPERVISOR" ? "SUPERVISOR" : "TICKETER",
            amount: remittance.amount,
            entry_type: "CREDIT", // A payment reduces liability
            reference_type: "REMITTANCE",
            reference_id: remittance.id,
            description: `Remittance verified. Debt reduced.`,
          }
        });

        // D) Handle expectations based on sender role (TICKETER vs SUPERVISOR) and cash destination
        const paidAmount = Number(remittance.amount);

              if (sender?.role === "TICKETER") {
          // Ticketer payments must have an allocation_id (paying off allocated device float)
          if (remittance.allocation_id) {
            const expectation = await tx.remittanceExpectation.findUnique({
              where: { allocation_id: remittance.allocation_id }
            });

            if (!expectation) throw new ApiError(404, "Expectation not found");
            if (expectation.status === "PAID") throw new ApiError(400, "Expectation is already paid");

            // 💡 TICKETER OVERPAYMENT GUARD
            if (paidAmount > expectation.expected_amount) {
              throw new ApiError(
                400,
                `Verified amount (${paidAmount}) exceeds the ticketer's expectation (${expectation.expected_amount}) for this allocation.`
              );
            }
            const remainingOwed = expectation.expected_amount - paidAmount;

            // Count other pending remittances for this allocation to determine next status
            const otherPendingCount = await tx.remittance.count({
              where: {
                company_id,
                allocation_id: remittance.allocation_id,
                id: { not: remittance.id },
                status: "PENDING"
              }
            });

            const now = new Date();
            const nextStatus = otherPendingCount > 0 
              ? (expectation.due_date < now ? "OVERDUE" : "SUBMITTED") 
              : "VIOLATED";

            // Update ticketer's original expectation with remaining amount
            await tx.remittanceExpectation.update({
              where: { id: expectation.id },
              data: {
                status: remainingOwed <= 0 ? "PAID" : nextStatus,
                expected_amount: remainingOwed <= 0 ? 0 : remainingOwed,
                shortage_amount: remainingOwed <= 0 ? 0 : remainingOwed,
              }
            });

            // If cash was handed to supervisor, create new expectation for the supervisor
            if (isSupervisorHoldingCash) {
              await tx.remittanceExpectation.create({
                data: {
                  company_id,
                  user_id: remittance.received_by_supervisor_id!,
                  allocation_id: null, // Supervisors do not have device allocation records
                  source_remittance_id: remittance.id,
                  expected_amount: paidAmount, // Supervisor is expected to remit exactly what was received
                  shortage_amount: 0,
                  due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours to remit
                  status: "PENDING",
                }
              });
            }
          }
        }else if (sender?.role === "SUPERVISOR") {
          // A supervisor is remitting cash. We clear their outstanding expectations using FIFO.
          const supervisorExpectations = await tx.remittanceExpectation.findMany({
            where: {
              user_id: remittance.submitted_by,
              status: { in: ["PENDING", "SUBMITTED", "OVERDUE", "VIOLATED"] },
              company_id,
            },
            orderBy: { created_at: "asc" },
          });

          const totalOutstanding = supervisorExpectations.reduce((sum, exp) => {
            return sum + exp.expected_amount;
          }, 0);

          if (paidAmount > totalOutstanding) {
            throw new ApiError(
              400,
              `Verified amount (${paidAmount}) exceeds the supervisor's total outstanding expectations (${totalOutstanding}).`
            );
          }


          let remainingPayment = paidAmount;

          for (const exp of supervisorExpectations) {
            if (remainingPayment <= 0) break;

            const expOwed = exp.expected_amount;

            if (remainingPayment >= expOwed) {
              // Fully satisfied this expectation
              remainingPayment -= expOwed;
              await tx.remittanceExpectation.update({
                where: { id: exp.id ,company_id},
                data: {
                  status: "PAID",
                  expected_amount: 0,
                  shortage_amount: 0,
                }
              });
            } else {
              // Partially satisfied this expectation; remaining is recorded as a shortage
              const newOwed = expOwed - remainingPayment;
              remainingPayment = 0;

              await tx.remittanceExpectation.update({
                where: { id: exp.id ,company_id},
                data: {
                  status: "VIOLATED",
                  expected_amount: newOwed,
                  shortage_amount: newOwed,
                }
              });
            }
          }
        }

      } else if (status === "REJECTED") {
        // If a ticketer remittance is rejected, restore their expectation status
        if (remittance.allocation_id) {
          const expectation = await tx.remittanceExpectation.findUnique({
            where: { allocation_id: remittance.allocation_id ,company_id}
          });
          if (expectation) {
            const pendingCount = await tx.remittance.count({
              where: {
                allocation_id: remittance.allocation_id,
                id: { not: remittance.id },
                status: "PENDING",
                company_id,
              }
            });

            const now = new Date();
            const restoredStatus = pendingCount > 0 
              ? (expectation.due_date < now ? "OVERDUE" : "SUBMITTED") 
              : (expectation.due_date < now ? "OVERDUE" : "PENDING");

            await tx.remittanceExpectation.update({
              where: { id: expectation.id ,company_id},
              data: { status: restoredStatus }
            });
          }
        }
      }


      // 3. Create Audit Log
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
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.statusCode === 500 ? "Internal Server Error" : error.message, message: error.statusCode === 500 ? "Internal Server Error" : error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal Server Error", message: "Internal Server Error" }, { status: 500 });
  }
}
