// src/app/api/supervisor/device/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supervisorId = session.user.id;
    const { company_id} = session.user;

    // Fetch all registered POS devices
    const devices = await prisma.pos_devices.findMany({
      where: { company_id },
      orderBy: { created_at: "desc" },
    });

    // Fetch sessions belonging only to the supervisor's ticketers
    const sessions = await prisma.posDeviceSession.findMany({
      where: {
        user: { supervisor_id: supervisorId },
        company_id
      },
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

    // 1. Get active sessions to identify free users (FIXED BUG)
    const activeSessions = await prisma.posDeviceSession.findMany({
      where: { status: "ACTIVE",company_id },
      select: { user_id: true },
    });
    const activeUserIds = activeSessions.map((s) => s.user_id);

    // 2. Available users are ANY ticketers who do not have an active session
    const availableUsers = await prisma.user.findMany({
      where: {
        role: "TICKETER",
        id: { notIn: activeUserIds },
        company_id
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
      },
    });

    // 3. Collect all unique supervisor/assigner IDs (assigned_by / unassigned_by)
    const supervisorIds = new Set<string>();
    sessions.forEach((s) => {
      if (s.assigned_by) supervisorIds.add(s.assigned_by);
      if (s.unassigned_by) supervisorIds.add(s.unassigned_by);
    });

    // 4. Fetch full names of those supervisors
    const supervisors = await prisma.user.findMany({
      where: { id: { in: Array.from(supervisorIds) },company_id },
      select: { id: true, first_name: true, last_name: true },
    });

    // 5. Create map of Supervisor ID -> Full Name
    const supervisorMap = new Map<string, string>();
    supervisors.forEach((sup) => {
      supervisorMap.set(sup.id, `${sup.first_name} ${sup.last_name}`.trim());
    });

    // 6. Send resolved supervisor names to frontend
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
        posFloat:s.sales_reports[0] ? Number(s.sales_reports[0].closing_balance) : Number(s.pos_float),
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
    console.error("GET /api/supervisor/device error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
