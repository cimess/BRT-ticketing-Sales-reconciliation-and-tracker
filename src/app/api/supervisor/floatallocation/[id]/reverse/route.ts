// src/app/api/supervisor/floatallocation/[id]/reverse/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { sendNotification } from "@/app/server/services/notification.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let allocationId = "";
  try {
    allocationId = (await params).id;
    const session = await auth();
    if (!session?.user?.id || !["ADMIN", "SUPERVISOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { company_id } = session.user;


    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the float allocation
      const allocation = await tx.float_allocations.findUnique({
        where: { id: allocationId, company_id }
      });

      if (!allocation) {
        throw new ApiError(404, "Float allocation not found");
      }

      if (allocation.status === "CANCELLED") {
        throw new ApiError(400, "Float allocation has already been reversed");
      }

      // 2. Fetch the target POS session and verify it is active
      const posSession = await tx.posDeviceSession.findUnique({
        where: { id: allocation.pos_device_id, company_id }
      });

      if (!posSession) {
        throw new ApiError(404, "POS device session not found");
      }

      if (posSession.status !== "ACTIVE") {
        throw new ApiError(400, "Cannot reverse allocation: The associated POS session is no longer active");
      }

      // 3. Prevent negative POS float (ensure ticketer has not already spent/remitted it)
      if (Number(posSession.pos_float) < Number(allocation.amount_allocated)) {
        throw new ApiError(
          400,
          `Cannot reverse allocation: The ticketer has already spent or remitted this float. Current session balance: ₦${Number(posSession.pos_float).toLocaleString()}, required: ₦${Number(allocation.amount_allocated).toLocaleString()}`
        );
      }

      // 4. Verify no remittances have been submitted for this active session
      const remittanceCount = await tx.remittance.count({
        where: {
          pos_session_id: allocation.pos_device_id,
          status: { in: ["PENDING", "CONFIRMED"] },
          company_id
        }
      });

      if (remittanceCount > 0) {
        throw new ApiError(400, "Cannot reverse allocation: Remittance has already been submitted against this POS session.");
      }

      // 5. Update the allocation status to CANCELLED
      const updatedAllocation = await tx.float_allocations.update({
        where: { id: allocationId, company_id },
        data: { status: "CANCELLED" }
      });

      // 6. Deduct float from the POS Session balance
      await tx.posDeviceSession.update({
        where: { id: allocation.pos_device_id, company_id },
        data: {
          pos_float: {
            decrement: allocation.amount_allocated
          }
        }
      });

      // 7. Refund the float back to the Company Vault
      await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT", company_id },
        data: {
          available_balance: {
            increment: allocation.amount_allocated
          }
        }
      });

      // 8. Adjust or delete the POS session expectation
      const expectation = await tx.remittanceExpectation.findUnique({
        where: { pos_session_id: allocation.pos_device_id }
      });
      if (expectation) {
        const newExpected = Math.max(0, expectation.expected_amount - Number(allocation.amount_allocated));
        if (newExpected === 0) {
          await tx.remittanceExpectation.delete({
            where: { id: expectation.id }
          });
        } else {
          await tx.remittanceExpectation.update({
            where: { id: expectation.id },
            data: {
              expected_amount: newExpected,
              shortage_amount: Math.max(0, expectation.shortage_amount - Number(allocation.amount_allocated)),
              status: expectation.status === "PAID" ? "PAID" : "PENDING"
            }
          });
        }
      }


      // 9. Write sync entries to the Float Ledger
      // A) Debit entry on POS Device to deduct float
      await tx.float_Ledger.create({
        data: {
          company_id,
          account_id: allocation.pos_device_id,
          account_type: "POS_DEVICE",
          posSession: allocation.pos_device_id,
          amount: allocation.amount_allocated,
          entry_type: "DEBIT",
          reference_type: "ALLOCATION_CANCEL",
          reference_id: allocationId,
          description: `Float allocation reversed by ${session.user.role}`
        }
      });

      // B) Credit entry on Company Account to return float
      await tx.float_Ledger.create({
        data: {
          company_id,
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount: allocation.amount_allocated,
          entry_type: "CREDIT",
          reference_type: "ALLOCATION_CANCEL",
          reference_id: allocationId,
          description: `Float allocation to POS session reversed by ${session.user.role}`
        }
      });

      // 10. Record in Audit Log
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: session.user.id!,
          action: "UPDATE",
          entity_type: "FLOAT_ALLOCATION",
          entity_id: allocationId,
          before_state: JSON.stringify(allocation),
          after_state: JSON.stringify(updatedAllocation),
          meta: { ip: req.headers.get("x-forwarded-for") || "" }
        }
      });
      await sendNotification({
        companyId: company_id,
        message: `Float allocation of ₦${Number(allocation.amount_allocated).toLocaleString()} has been reversed/cancelled.`,
        type: "FLOAT_UPDATED",
        referenceId: allocationId,
        target: {
          userIds: [posSession.user_id], // Targets the ticketer
        },
      });
      return updatedAllocation;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error(`PATCH /api/supervisor/floatallocation/${allocationId}/reverse error:`, error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
