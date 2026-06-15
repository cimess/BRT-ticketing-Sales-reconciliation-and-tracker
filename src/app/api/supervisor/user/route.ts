// src/app/api/supervisor/user/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    // SECURITY: Ensure the user is actually a Supervisor
    if (!session?.user?.id || session.user.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Unauthorized. Only Supervisors can access this." }, { status: 403 });
    }

    // Fetch ONLY the ticketers assigned to this specific supervisor
    const ticketers = await prisma.user.findMany({
      where: {
        supervisor_id: session.user.id,
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

    return NextResponse.json({ success: true, data: ticketers });
  } catch (error) {
    console.error("GET /api/supervisor/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
