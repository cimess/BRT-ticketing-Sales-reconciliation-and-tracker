// src/app/api/supervisor/device/assign/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/ApiError";
import { sendNotification } from "@/app/server/services/notification.service";

// 1. Assign POS Device to a user (Creates a POS Device Session + Updates Ticketer Supervisor)
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;
    const { deviceId, userId } = await req.json();

    if (!deviceId || !userId) {
      return NextResponse.json({ error: "Device ID and User ID are required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // a. Validate POS device exists and is inactive
      const device = await tx.pos_devices.findUnique({
        where: { id: deviceId, company_id },
      });
      if (!device) throw new ApiError(404, "POS device not found");
      if (device.status === "ACTIVE") throw new ApiError(400, "Device is already assigned to a session");
      if (device.status === "MAINTENANCE") throw new ApiError(400, "Device is currently in maintenance");

      // b. Validate user has role TICKETER and has no other active assignments
      const targetUser = await tx.user.findUnique({
        where: { id: userId, company_id },
      });
      if (!targetUser) throw new ApiError(404, "User not found");
      if (targetUser.role !== "TICKETER") throw new ApiError(400, "Only ticketers can be assigned a device by a supervisor");

      const activeUserSession = await tx.posDeviceSession.findFirst({
        where: { user_id: userId, status: "ACTIVE", company_id },
      });
      if (activeUserSession) throw new ApiError(400, "This user is already active on another POS device");

      // c. Fetch remaining float from the device's last session (carry over / handover)
      const lastSession = await tx.posDeviceSession.findFirst({
        where: { device_id: deviceId, company_id },
        orderBy: { assigned_at: "desc" },
      });

      const carriedOverFloat = lastSession ? lastSession.pos_float : new Prisma.Decimal(0);

      // d. Create assignment session with the carried over float
      const newSession = await tx.posDeviceSession.create({
        data: {
          company_id,
          device_id: deviceId,
          user_id: userId,
          pos_float: carriedOverFloat,
          assigned_by: session.user.id!,
          status: "ACTIVE",
        },
      });

      // 💡 1. Decrement carried-over float from previous session's expectation (avoid double charging)
      if (lastSession && carriedOverFloat.gt(0)) {
        const lastExpectation = await tx.remittanceExpectation.findUnique({
          where: { pos_session_id: lastSession.id }
        });
        if (lastExpectation) {
          const updatedExpected = Math.max(0, Number(lastExpectation.expected_amount) - Number(carriedOverFloat));
          const updatedShortage = Math.max(0, Number(lastExpectation.shortage_amount) - Number(carriedOverFloat));
          await tx.remittanceExpectation.update({
            where: { id: lastExpectation.id },
            data: {
              expected_amount: updatedExpected,
              shortage_amount: updatedShortage,
              status: updatedShortage <= 0 ? "PAID" : lastExpectation.status
            }
          });
        }
      }

      // 💡 2. Initialize the new session's expectation with the carried-over opening float
      if (carriedOverFloat.gt(0)) {
        await tx.remittanceExpectation.create({
          data: {
            company_id,
            user_id: userId,
            pos_session_id: newSession.id,
            expected_amount: Number(carriedOverFloat),
            shortage_amount: Number(carriedOverFloat),
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "PENDING",
          }
        });
      }


      // e. Update device status to ACTIVE
      await tx.pos_devices.update({
        where: { id: deviceId, company_id },
        data: { status: "ACTIVE" },
      });

      // f. AUTO-UPDATE: Set the ticketer's supervisor to the assigning supervisor
      if (session.user.role === "SUPERVISOR") {
        await tx.user.update({
          where: { id: userId, company_id },
          data: { supervisor_id: session.user.id! },
        });
      }

      // g. Log the carried-over opening balance to the POS ledger
      if (carriedOverFloat.gt(0)) {
        await tx.float_Ledger.create({
          data: {
            company_id,
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

      // audit log for supervisor action
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: session.user.id!,
          action: "CREATE",
          entity_type: "POS_DEVICE",
          entity_id: newSession.id,
          after_state: newSession,
        }
      });

        await sendNotification({
        companyId: company_id, // Change 'company_id' to 'companyId' here
        message: `POS Device ${device.serial_number} has been assigned to you. Opening balance: ₦${Number(carriedOverFloat).toLocaleString()}.`,
        type: "NOTIFICATION_CREATED",
        referenceId: newSession.id,
        target: {
          userIds: [userId], // Targets the assigned ticketer
        },
      });


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
    return NextResponse.json({
      success: false,
      message: error instanceof ApiError ? (error.statusCode === 500 ? "Internal Server Error" : error.message) :
        "Internal Server Error"
    },
      { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}

// 2. Unassign / Return POS Device (Closes the POS Device Session)
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;
    const { sessionId, reason } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // a. Fetch target assignment session
 const posSession = await tx.posDeviceSession.findUnique({
        where: { id: sessionId, company_id },
        include: { 
          user: true, 
          device: true // Add this so we have access to the device details
        },
      });
      if (!posSession || posSession.status !== "ACTIVE") {
        throw new ApiError(404, "Active POS session not found or already closed");
      }

      // b. Security check: Supervisors can only unassign devices assigned to ticketers under them
      if (session.user.role === "SUPERVISOR" && posSession.user.supervisor_id !== session.user.id) {
        throw new ApiError(403, "You can only unassign devices for ticketers under your supervision");
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


      // c. Update session status to RETURNED (preserving the remaining pos_float value)
      const updatedSession = await tx.posDeviceSession.update({
        where: { id: sessionId, company_id },
        data: {
          status: "RETURNED",
          unassigned_at: new Date(),
          unassigned_by: session.user.id!,
          unassigned_reason: reason || "Device returned to supervisor",
        },
      });

      // d. Release device back to INACTIVE status
      await tx.pos_devices.update({
        where: { id: posSession.device_id, company_id },
        data: { status: "INACTIVE" },
      });

      // audit log for supervisor action
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

     await sendNotification({
        companyId: company_id, // Using 'companyId'
        message: `POS Device ${posSession.device.serial_number} has been unassigned. Reason: ${reason || "Device returned to supervisor"}`,
        type: "NOTIFICATION_CREATED",
        referenceId: updatedSession.id,
        target: {
          userIds: [posSession.user_id], // Targets the ticketer who owned the session
        },
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
    return NextResponse.json({
      success: false,
      message: error instanceof ApiError ? (error.statusCode === 500 ? "Internal Server Error" : error.message) :
        "Internal Server Error"
    },
      { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
