// src/app/api/supervisor/user/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheInvalidate } from "@/app/lib/redis";


export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    // SECURITY: Ensure the user is actually a Supervisor
    if (!session?.user?.id || session.user.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Unauthorized. Only Supervisors can access this." }, { status: 403 });
    }
    const { company_id } = session.user;

       const supervisorId = session.user.id;
    const cacheKey = `cache:supervisor-team:${supervisorId}`;
    const cachedTeam = await cacheGet(cacheKey);
    if (cachedTeam) {
      return NextResponse.json(cachedTeam);
    }

    // Fetch ONLY the ticketers assigned to this specific supervisor
    const ticketers = await prisma.user.findMany({
      where: {
        supervisor_id: session.user.id,
        company_id,
        role: "TICKETER"
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
      },
      orderBy: { createdAt: "desc" } 
    });

        const responsePayload = { success: true, data: ticketers };

    // 3. Cache the team list for 5 minutes (300s)
    await cacheSet(cacheKey, responsePayload, 300);
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("GET /api/supervisor/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
