// src/app/api/supervisor/device/assign/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/ApiError";

// 1. Assign POS Device to a user (Creates a POS Device Session + Updates Ticketer Supervisor)
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deviceId, userId } = await req.json();

    if (!deviceId || !userId) {
      return NextResponse.json({ error: "Device ID and User ID are required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // a. Validate POS device exists and is inactive
      const device = await tx.pos_devices.findUnique({
        where: { id: deviceId },
      });
      if (!device) throw new ApiError(404,"POS device not found" );
      if (device.status === "ACTIVE") throw new ApiError(400,"Device is already assigned to a session" );
      if (device.status === "MAINTENANCE") throw new ApiError(400,"Device is currently in maintenance" );

      // b. Validate user has role TICKETER and has no other active assignments
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!targetUser) throw new ApiError(404,"User not found" );
      if (targetUser.role !== "TICKETER") throw new ApiError(400,"Only ticketers can be assigned a device by a supervisor" );

      const activeUserSession = await tx.posDeviceSession.findFirst({
        where: { user_id: userId, status: "ACTIVE" },
      });
      if (activeUserSession) throw new ApiError(400,"This user is already active on another POS device" );

      // c. Fetch remaining float from the device's last session (carry over / handover)
      const lastSession = await tx.posDeviceSession.findFirst({
        where: { device_id: deviceId },
        orderBy: { assigned_at: "desc" },
      });

      const carriedOverFloat = lastSession ? lastSession.pos_float : new Prisma.Decimal(0);

      // d. Create assignment session with the carried over float
      const newSession = await tx.posDeviceSession.create({
        data: {
          device_id: deviceId,
          user_id: userId,
          pos_float: carriedOverFloat,
          assigned_by: session.user.id!,
          status: "ACTIVE",
        },
      });

      // e. Update device status to ACTIVE
      await tx.pos_devices.update({
        where: { id: deviceId },
        data: { status: "ACTIVE" },
      });

      // f. AUTO-UPDATE: Set the ticketer's supervisor to the assigning supervisor
      if (session.user.role === "SUPERVISOR") {
        await tx.user.update({
          where: { id: userId },
          data: { supervisor_id: session.user.id! },
        });
      }

      // g. Log the carried-over opening balance to the POS ledger
      if (carriedOverFloat.gt(0)) {
        await tx.float_Ledger.create({
          data: {
            account_id: newSession.id,
            account_type: "POS_DEVICE",
            posSession: newSession.id,
            amount: carriedOverFloat,
            entry_type: "CREDIT",
            reference_type: "SESSION_OPENING",
            reference_id: newSession.id,
            description: `Opening float balance carried over from previous session`,
          },
        });
      }

      return newSession;
    });

    return NextResponse.json({
      success: true,
      message: "POS device assigned successfully and ticketer auto-assigned under your supervision",
      session: {
        id: result.id,
        deviceId: result.device_id,
        userId: result.user_id,
        posFloat: Number(result.pos_float),
        assignedAt: result.assigned_at,
        status: result.status,
      },
    });
  } catch (error) {
    console.error("POST /api/supervisor/device/assign error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 400 });
  }
}

// 2. Unassign / Return POS Device (Closes the POS Device Session)
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, reason } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // a. Fetch target assignment session
      const posSession = await tx.posDeviceSession.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });
      if (!posSession || posSession.status !== "ACTIVE") {
        throw new ApiError(404,"Active POS session not found or already closed" );
      }

      // b. Security check: Supervisors can only unassign devices assigned to ticketers under them
      if (session.user.role === "SUPERVISOR" && posSession.user.supervisor_id !== session.user.id) {
        throw new ApiError(403,"You can only unassign devices for ticketers under your supervision" );
      }

      // c. Update session status to RETURNED (preserving the remaining pos_float value)
      const updatedSession = await tx.posDeviceSession.update({
        where: { id: sessionId },
        data: {
          status: "RETURNED",
          unassigned_at: new Date(),
          unassigned_by: session.user.id!,
          unassigned_reason: reason || "Device returned to supervisor",
        },
      });

      // d. Release device back to INACTIVE status
      await tx.pos_devices.update({
        where: { id: posSession.device_id },
        data: { status: "INACTIVE" },
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
    console.error("PUT /api/supervisor/device/assign error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 400 });
  }
}
