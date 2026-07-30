// src/app/api/supervisor/device/maintenance/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/app/lib/ApiError";
import { cacheInvalidate } from "@/app/lib/redis";

// PUT: Transitions a POS device from MAINTENANCE status back to INACTIVE (Available for assignment)
export async function PUT(req: Request) {
  try {
    // 1. Authentication & Role Guard (Supervisors and Admins only)
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { company_id } = session.user;
    if (!company_id) {
      return NextResponse.json({ error: "Company association is required" }, { status: 400 });
    }

    // 2. Parse and validate the request body
    const body = await req.json();
    const { deviceId } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
    }

    // 3. Process status update in a database transaction
    const updatedDevice = await prisma.$transaction(async (tx) => {
      // a. Find target POS device
      const device = await tx.pos_devices.findUnique({
        where: { id: deviceId, company_id },
      });

      if (!device) {
        throw new ApiError(404, "POS device not found");
      }

      // b. Verify the device is currently in maintenance status
      if (device.status !== "MAINTENANCE") {
        throw new ApiError(
          400,
          `POS device is not in maintenance. Current status: ${device.status}`
        );
      }

      // c. Update device status to INACTIVE
      const updated = await tx.pos_devices.update({
        where: { id: deviceId, company_id },
        data: { status: "INACTIVE" },
      });

      // d. Create an audit log entry for tracking
      await tx.auditLog.create({
        data: {
          company_id,
          user_id: session.user.id!,
          action: "UPDATE",
          entity_type: "POS_DEVICE",
          entity_id: deviceId,
          before_state: { status: device.status },
          after_state: { status: updated.status },
        },
      });

      return updated;
    });

    // 4. Invalidate relevant redis caches
    await cacheInvalidate(`cache:devices:${company_id}`);

    return NextResponse.json({
      success: true,
      message: `Device ${updatedDevice.name} has been returned from maintenance and marked as INACTIVE.`,
      device: {
        id: updatedDevice.id,
        name: updatedDevice.name,
        serialNumber: updatedDevice.serial_number,
        status: updatedDevice.status,
      },
    });
  } catch (error: unknown) {
    console.error("PUT /api/supervisor/device/maintenance error:", error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
