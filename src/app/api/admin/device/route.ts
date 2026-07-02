// src/app/api/admin/device/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";


export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all registered POS devices
    const devices = await prisma.pos_devices.findMany({
      orderBy: { created_at: "desc" },
    });

    // Fetch all POS session assignments
    const sessions = await prisma.posDeviceSession.findMany({
      where: { company_id: session.user.company_id },
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
      where: { company_id: session.user.company_id, status: "ACTIVE" },
      select: { user_id: true },
    });
    const activeUserIds = activeSessions.map((s) => s.user_id);

    const availableUsers = await prisma.user.findMany({
      where: {
        role: { in: ["TICKETER", "SUPERVISOR"] },
        company_id: session.user.company_id,
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
      where: { id: { in: Array.from(supervisorIds) }, company_id: session.user.company_id },
      select: { id: true, first_name: true, last_name: true },
    });

    const supervisorMap = new Map<string, string>();
    supervisors.forEach((sup) => {
      supervisorMap.set(sup.id, `${sup.first_name} ${sup.last_name}`.trim());
    });

    return NextResponse.json({
      success: true,
      devices,
      sessions: sessions.map((s) => ({
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
    });
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
