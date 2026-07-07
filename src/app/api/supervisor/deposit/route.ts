// src/app/api/supervisor/deposit/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { sendNotification } from "@/app/server/services/notification.service";

// POST: Submit cash holdings as DEPOSITED to bank
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: userId, role, company_id } = session.user;

    if (role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Only supervisors can deposit cash holdings" }, { status: 403 });
    }

    const body = await req.json();
    const { remittance_ids, deposit_all, payment_reference } = body;

    const result = await prisma.$transaction(async (tx) => {
      let idsToUpdate: string[] = [];

      if (deposit_all) {
        // Find all cash accepted by this supervisor that hasn't been deposited yet
        const pendingRecords = await tx.remittance.findMany({
          where: {
            company_id,
            received_by_supervisor_id: userId,
            status: "ACCEPTED_BY_SUPERVISOR",
          },
          select: { id: true }
        });
        idsToUpdate = pendingRecords.map(r => r.id);
      } else if (Array.isArray(remittance_ids) && remittance_ids.length > 0) {
        idsToUpdate = remittance_ids;
      } else {
        throw new ApiError(400, "Please provide remittance IDs or select deposit_all");
      }

      if (idsToUpdate.length === 0) {
        throw new ApiError(404, "No accepted cash holdings available for deposit");
      }

      // Update state to DEPOSITED and attach payment reference
      const updated = await tx.remittance.updateMany({
        where: {
          id: { in: idsToUpdate },
          company_id,
          received_by_supervisor_id: userId,
          status: "ACCEPTED_BY_SUPERVISOR",
        },
        data: {
          status: "DEPOSITED",
          payment_reference: payment_reference || null,
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: userId,
          action: "DEPOSIT",
          entity_type: "DEPOSIT_CASH",
          entity_id: idsToUpdate.join(","),
          after_state: JSON.stringify({ count: updated.count, ids: idsToUpdate, reference: payment_reference }),
        }
      });

       await sendNotification({
        companyId: company_id,
        message: `Supervisor deposited ${idsToUpdate.length} cash holdings to the bank. Payment Reference: ${payment_reference || "N/A"}.`,
        type: "REMITTANCE_CREATED",
        target: {
          roles: ["ADMIN"], // Notifies Admins to verify it
          userIds: [userId], // Notifies the supervisor to update their UI
        },
      });

      return { count: updated.count, ids: idsToUpdate };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("POST /api/supervisor/deposit error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: Reverse a DEPOSITED batch back to ACCEPTED_BY_SUPERVISOR (if mistake made before Admin verification)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: userId, role, company_id } = session.user;
    const body = await req.json();
    const { remittance_ids } = body;

    if (!Array.isArray(remittance_ids) || remittance_ids.length === 0) {
      return NextResponse.json({ error: "Missing remittance_ids array" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.remittance.updateMany({
        where: {
          id: { in: remittance_ids },
          company_id,
          status: "DEPOSITED", // Can only reverse if not yet confirmed by Admin
        },
        data: {
          status: "ACCEPTED_BY_SUPERVISOR",
        }
      });

      return { count: updated.count };
    });

    if (result.count === 0) {
  return NextResponse.json(
    {
      success: false,
      message: "No remittances were updated. They may have already been accepted or do not exist.",
    },
    { status: 409 }
  );
}

await sendNotification({
        companyId: company_id,
        message: `Deposit reversed by supervisor.`,
        type: "REMITTANCE_REVERSED",
        target: {
          roles: ["ADMIN"],
          userIds: [userId], 
        },
      });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
