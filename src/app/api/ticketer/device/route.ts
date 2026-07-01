import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id, id: userId } = session.user;

    const sessions = await prisma.posDeviceSession.findMany({
      where: { user_id: userId, company_id },
      include: {
        device: true,
        user: {
          select: { id: true, first_name: true, last_name: true, email: true, role: true },
        },
      },
      orderBy: { assigned_at: "desc" },
    });

    const dbLocations = await prisma.ticketer_Location_Assignment.findMany({
      where: { user_id: userId, company_id },
      include: { location: true },
      orderBy: { assigned_for: "desc" },
    });

    const locations = dbLocations.map((la) => ({
      id: la.id,
      assignmentId: la.id,
      locationName: la.location.name,
      locationAddress: la.location.address,
      assignedFor: la.assigned_for.toISOString(),
    }));

    // Collect all unique supervisor/assigner IDs
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

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceId: s.device_id,
        deviceName: s.device.name,
        deviceSerial: s.device.serial_number,
        userId: s.user_id,
        username: `${s.user.first_name} ${s.user.last_name}`.trim(),
        userRole: s.user.role,
        posFloat: Number(s.pos_float),
        assignedAt: s.assigned_at,
        unassignedAt: s.unassigned_at,
        assignedBy: supervisorMap.get(s.assigned_by) || s.assigned_by,
        unassignedBy: s.unassigned_by ? (supervisorMap.get(s.unassigned_by) || s.unassigned_by) : null,
        unassignedReason: s.unassigned_reason,
        status: s.status,
      })),
      locations,
    });
  } catch (error) {
    console.error("GET /api/ticketer/device error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
