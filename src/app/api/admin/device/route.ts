// src/app/api/admin/device/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheInvalidate } from "@/app/lib/redis";


export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

     const company_id = session.user.company_id;
    const cacheKey = `cache:devices:${company_id}`;
    const cachedDevices = await cacheGet(cacheKey);
    if (cachedDevices) {
      return NextResponse.json(cachedDevices);
    }


    // Fetch all registered POS devices
    const devices = await prisma.pos_devices.findMany({
      where:{company_id},
      orderBy: { created_at: "desc" },
    });

    // Fetch all POS session assignments
    const sessions = await prisma.posDeviceSession.findMany({
      where: { company_id },
      include: {
        device: true,
        user: {
          select: { id: true, first_name: true, last_name: true, email: true, role: true },
        },
        sales_reports: {
          where: { status: { notIn: ["CANCELLED", "REJECTED"] } },
          orderBy: { submitted_at: "desc" },
          take: 1,
          select: { closing_balance: true }
        }
      },
      orderBy: { assigned_at: "desc" },
    });

    const activeSessions = await prisma.posDeviceSession.findMany({
      where: { company_id, status: "ACTIVE" },
      select: { user_id: true },
    });
    const activeUserIds = activeSessions.map((s: { user_id: string }) => s.user_id);

    const availableUsers = await prisma.user.findMany({
      where: {
        role: { in: ["TICKETER", "SUPERVISOR"] },
        company_id,
        id: { notIn: activeUserIds },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
      },
    });

    // Collect all unique supervisor/assigner IDs (assigned_by / unassigned_by)
    const supervisorIds = new Set<string>();
    sessions.forEach((s) => {
      if (s.assigned_by) supervisorIds.add(s.assigned_by);
      if (s.unassigned_by) supervisorIds.add(s.unassigned_by);
    });

    const supervisors = await prisma.user.findMany({
      where: { id: { in: Array.from(supervisorIds) }, company_id },
      select: { id: true, first_name: true, last_name: true },
    });

    const supervisorMap = new Map<string, string>();
    supervisors.forEach((sup) => {
      supervisorMap.set(sup.id, `${sup.first_name} ${sup.last_name}`.trim());
    });

    const responsePayload = {
      success: true,
      devices,
      sessions: sessions.map((s: {
        id: string;
        device_id: string;
        device: {
          name: string;
          serial_number: string;
        };
        user_id: string;
        user: {
          first_name: string;
          last_name: string;
          role: string;
        };
        sales_reports: {
          closing_balance: number | object;
        }[];
        pos_float: number | object;
        assigned_at: Date;
        unassigned_at: Date | null;
        assigned_by: string;
        unassigned_by: string | null;
        unassigned_reason: string | null;
        status: string;
      }) => ({
        id: s.id,
        deviceId: s.device_id,
        deviceName: s.device.name,
        deviceSerial: s.device.serial_number,
        userId: s.user_id,
        username: `${s.user.first_name} ${s.user.last_name}`.trim(),
        userRole: s.user.role,
        posFloat: s.sales_reports[0] ? Number(s.sales_reports[0].closing_balance) : Number(s.pos_float),
        assignedAt: s.assigned_at,
        unassignedAt: s.unassigned_at,
        assignedBy: supervisorMap.get(s.assigned_by) || s.assigned_by,
        unassignedBy: s.unassigned_by ? (supervisorMap.get(s.unassigned_by) || s.unassigned_by) : null,
        unassignedReason: s.unassigned_reason,
        status: s.status,
      })),
      availableUsers,
    };
     // 3. Cache the devices list for 5 minutes (300s)
    await cacheSet(cacheKey, responsePayload, 300);
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("GET /api/admin/devices error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


// Add this at the end of src/app/api/admin/device/route.ts
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, serial_number, status } = await req.json();

    if (!name || !serial_number) {
      return NextResponse.json({ error: "Name and Serial Number are required" }, { status: 400 });
    }

    const existingDevice = await prisma.pos_devices.findFirst({
      where: {
        company_id: session.user.company_id,
        OR: [{ name }, { serial_number }],
      },
    });

    if (existingDevice) {
      return NextResponse.json(
        { error: "Device name or serial number is already registered" },
        { status: 400 }
      );
    }

    const newDevice = await prisma.pos_devices.create({
      data: {
        company_id: session.user.company_id,
        name,
        serial_number,
        status: status || "INACTIVE",
      },
    });

    // Invalidate the cache
 await cacheInvalidate(`cache:devices:${session.user.company_id}`);

    return NextResponse.json({
      success: true,
      message: "POS Device created successfully",
      device: newDevice,
    });
  } catch (error) {
    console.error("POST /api/admin/devices error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
