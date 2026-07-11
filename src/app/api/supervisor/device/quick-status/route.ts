// src/app/api/supervisor/device/quick-status/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/ApiError";
import { cacheGet, cacheSet } from "@/app/lib/redis";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: supervisorId, role, company_id: companyId } = session.user;

      const cacheKey = `cache:quick-status:${companyId}:${supervisorId}`;
    const cachedStatus = await cacheGet(cacheKey);
    if (cachedStatus) {
      return NextResponse.json(cachedStatus);
    }

    // Fetch all registered POS devices
    const devices = await prisma.pos_devices.findMany({
      where: { company_id: companyId },
      orderBy: { name: "asc" },
    });

    const result = await Promise.all(
      devices.map(async (device: {
        id: string;
        name: string;
        serial_number: string;
        status: string;
      }) => {
        // Fetch the last session for this device
        const lastSession = await prisma.posDeviceSession.findFirst({
          where: { device_id: device.id, company_id: companyId },
          orderBy: { assigned_at: "desc" },
          include: {
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                role: true,
                restricted: true,
                supervisor_id: true,
              },
            },
          },
        });

        if (!lastSession) {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status, // ACTIVE, INACTIVE, MAINTENANCE
            activeSession: null,
            lastSession: null,
            isEligible: false,
            reason: "No prior session history. Assign manually first.",
          };
        }

        const isSupervisorOwned =
          role === "ADMIN" ||
          lastSession.user.supervisor_id === supervisorId ||
          lastSession.assigned_by === supervisorId;

        // If active, it has a current session
        if (device.status === "ACTIVE" && lastSession.status === "ACTIVE") {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: {
              id: lastSession.id,
              userId: lastSession.user.id,
              userName: `${lastSession.user.first_name} ${lastSession.user.last_name}`.trim(),
              currentFloat: Number(lastSession.pos_float),
              assignedAt: lastSession.assigned_at,
            },
            isEligible: isSupervisorOwned,
            reason: isSupervisorOwned ? null : "Assigned under another supervisor.",
          };
        }

        // If active, but session closed or device in maintenance
        if (device.status === "MAINTENANCE") {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: lastSession.user.id,
              userName: `${lastSession.user.first_name} ${lastSession.user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "Device is in maintenance.",
          };
        }

        // Device is INACTIVE. Let's validate the ticketer eligibility for Quick Reactivation
        const user = lastSession.user;

        if (user.role !== "TICKETER") {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: user.id,
              userName: `${user.first_name} ${user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "Last holder is no longer a Ticketer.",
          };
        }

        if (user.restricted) {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: user.id,
              userName: `${user.first_name} ${user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "Last holder's account is restricted.",
          };
        }

        if (!isSupervisorOwned) {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: user.id,
              userName: `${user.first_name} ${user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "Last holder is under another supervisor.",
          };
        }

        const otherActiveSession = await prisma.posDeviceSession.findFirst({
          where: {
            user_id: user.id,
            status: "ACTIVE",
            company_id: companyId,
          },
        });
        if (otherActiveSession) {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: user.id,
              userName: `${user.first_name} ${user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "User is active on another device.",
          };
        }

        const pendingSales = await prisma.salesReport.findFirst({
          where: {
            pos_session_id: lastSession.id,
            status: "PENDING",
            company_id: companyId,
          },
        });
        if (pendingSales) {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: user.id,
              userName: `${user.first_name} ${user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "Pending sales report must be verified first.",
          };
        }

        const pendingRemittance = await prisma.remittance.findFirst({
          where: {
            pos_session_id: lastSession.id,
            status: "PENDING",
            company_id: companyId,
          },
        });
        if (pendingRemittance) {
          return {
            id: device.id,
            name: device.name,
            serialNumber: device.serial_number,
            status: device.status,
            activeSession: null,
            lastSession: {
              userId: user.id,
              userName: `${user.first_name} ${user.last_name}`.trim(),
              lastFloat: Number(lastSession.pos_float),
              closedAt: lastSession.unassigned_at,
            },
            isEligible: false,
            reason: "Pending remittances must be verified first.",
          };
        }

        return {
          id: device.id,
          name: device.name,
          serialNumber: device.serial_number,
          status: device.status,
          activeSession: null,
          lastSession: {
            userId: user.id,
            userName: `${user.first_name} ${user.last_name}`.trim(),
            lastFloat: Number(lastSession.pos_float),
            closedAt: lastSession.unassigned_at,
          },
          isEligible: true,
          reason: null,
        };
      })
    );

  const responsePayload = {
      success: true,
      devices: result,
    };
    await cacheSet(cacheKey, responsePayload, 15); // 15s TTL (Short due to high real-time state requirements)
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("GET /api/supervisor/device/quick-status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
