// src/app/api/admin/user/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheInvalidate } from "@/app/lib/redis";

// 1. FETCH USERS WITH AUDIT LOGS, FINES AND REMITTANCES
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { role: userRole } = session.user;
    const { searchParams } = new URL(req.url);
    let roleFilter = searchParams.get("role");
    
    // Security check: Force non-admins (like TICKETER) to only fetch supervisors
    if (!["ADMIN", "AUDITOR"].includes(userRole)) {
      roleFilter = "SUPERVISOR";
    }

        const cacheKey = `cache:users-audit:${session.user.company_id}:${roleFilter || "all"}`;
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const whereCondition: Record<string, string> = {};
    
    if (roleFilter) {
      whereCondition.role = roleFilter;
    }

    // Query full details from database
    const users = await prisma.user.findMany({
      where: { company_id: session.user.company_id, ...whereCondition },
      include: {
        supervisor: {
          select: {
            first_name: true,
            last_name: true,
          }
        },
        fines: true,       // Fines received
        remittances: true,
      },
      orderBy: { createdAt: "desc" }
    });

    // Fetch reconciliation reports to map shortage history
    const liveExpectations = await prisma.remittanceExpectation.findMany({
      where: { company_id: session.user.company_id,shortage_amount: { gt: 0 } }
    });

    // Map DB structures to match the frontend User_Full_Audit interface
    const mappedUsers = users.map(user => {
      const userLiveExpectations = liveExpectations.filter(r => r.user_id === user.id);
      return {
        user_id: user.id,
        username: `${user.first_name} ${user.last_name}`,
        guarantor: user.guarantor_name || null,
        guarantor_phone: user.guarantor_phone || null,
        guarantor_address: user.guarantor_address || null,
        role: user.role,
        created_at: user.createdAt.toISOString(),
        address: user.address || undefined,
        supervisor: user.supervisor ? `${user.supervisor.first_name} ${user.supervisor.last_name}` : undefined,
        phone: user.phone || undefined,
        email: user.email,
        restricted: user.restricted,
        fines: user.fines.map(f => ({
          id: f.id,
          defaulter_id: f.defaulter_id,
          amount: Number(f.amount),
          reason: f.reason,
          issued_by: f.issued_by,
          status: f.status,
          created_at: f.created_at.toISOString(),
        })),
        reconciliation: userLiveExpectations.map(e => ({
          run_id: e.id,
          actor: `${user.first_name} ${user.last_name}`,
          date: e.created_at.toISOString().split("T")[0],
          expected_float: Number(e.expected_amount),
          actual_remittance: Number(e.expected_amount) - Number(e.shortage_amount),
          variance: Number(e.shortage_amount),
          status: e.status,
          scope: "SESSION",
          generated_at: e.created_at.toISOString(),
        })),

      };
    });

 const responsePayload = { success: true, data: mappedUsers };
    await cacheSet(cacheKey, responsePayload, 60); // 1 min TTL
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("GET /api/admin/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


// 2. RESTRICT (BAN) OR UNRESTRICT A USER
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    
    // SECURITY: Only Admins can restrict users!
    if (!session?.user || session.user.role !== "ADMIN"||!session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Only Admins can restrict users." }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, restricted } = body;

    if (!user_id || typeof restricted !== "boolean") {
      return NextResponse.json({ error: "Missing user_id or restricted status" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user_id, company_id: session.user.company_id },
      data: { restricted: restricted },
    });

    // Log the security action
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "UPDATE",
        entity_type: "USER",
        entity_id: user_id,
        after_state: updatedUser,
        company_id: session.user.company_id,
      }
    });

    // Add before returning updated response:
await cacheInvalidate(
  `cache:users-audit:${session.user.company_id}:*`,
  `cache:supervisor-team:*` // Clear supervisor teams in case hierarchy changed
);

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("PATCH /api/admin/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
