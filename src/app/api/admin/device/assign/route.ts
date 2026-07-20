// src/app/api/admin/device/assign/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/ApiError";

// 2. Unassign / Return POS Device (Closes the POS Device Session)
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN"||!session.user.company_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, reason } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Get company_id from session
    const { company_id } = session.user;

    const result = await prisma.$transaction(async (tx) => {
      // a. Fetch target assignment session
      const posSession = await tx.posDeviceSession.findUnique({
        where: { id: sessionId, company_id: company_id },
      });
      if (!posSession || posSession.status !== "ACTIVE") {
        throw new ApiError(404, "Active POS session not found or already closed");
      }


      // 1. Check for pending remittances on this session or by this user
      const pendingRemittance = await tx.remittance.findFirst({
        where: {
          company_id,
          pos_session_id: posSession.id,
          status: "PENDING",
        },
      });

      if (pendingRemittance) {
        throw new ApiError(
          400,
          "Cannot return POS device: The ticketer has pending remittances for this session that must be verified first."
        );
      }

      // 2. Check for unverified sales reports submitted for this session
      const pendingSalesReport = await tx.salesReport.findFirst({
        where: {
          company_id,
          pos_session_id: posSession.id,
          status: "PENDING",
        },
      });

      if (pendingSalesReport) {
        throw new ApiError(
          400,
          "Cannot return POS device: There is a pending sales report for this session awaiting verification."
        );
      }


      // b. Update session status to RETURNED (preserving the remaining pos_float value)
      const updatedSession = await tx.posDeviceSession.update({
        where: { id: sessionId, company_id},
        data: {
          status: "RETURNED",
          unassigned_at: new Date(),
          unassigned_by: session.user.id!,
          unassigned_reason: reason || "Device returned to office",
          company_id: session.user.company_id,
          // The pos_float is NOT reset to 0; we preserve it to carry over to the next user.
        },
      });

      // c. Release device back to INACTIVE status
      await tx.pos_devices.update({
        where: { id: posSession.device_id, company_id},
        data: { status: "INACTIVE" },
      });

      // audit log for admin action
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: session.user.id!,
          action: "UPDATE",
          entity_type: "POS_DEVICE",
          entity_id: updatedSession.id,
          before_state: posSession,
          after_state: updatedSession,
        }
      });

      return updatedSession;
    });

    return NextResponse.json({
      success: true,
      message: "POS device returned and released successfully",
      session: {
        id: result.id,
        deviceId: result.device_id,
        userId: result.user_id,
        posFloat: Number(result.pos_float),
        unassignedAt: result.unassigned_at,
        status: result.status,
      },
    });
  } catch (error) {
    console.error("PUT /api/admin/device/assign error:", error);

    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 400 });
  }
}
