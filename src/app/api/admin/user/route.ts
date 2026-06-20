// src/app/api/admin/user/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    const reconciliationReports = await prisma.reconciliation_reports.findMany({
      where: { company_id: session.user.company_id }
    });

    // Map DB structures to match the frontend User_Full_Audit interface
    const mappedUsers = users.map(user => {
      const userReconciliations = reconciliationReports.filter(r => r.user_id === user.id);
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
        remitance: user.remittances.map(r => ({
          id: r.id,
          remit_id: r.id,
          method: r.method,
          amount: Number(r.amount),
          status: r.status,
          proof_ref: r.payment_reference || undefined,
          submitted_at: r.created_at.toISOString(),
          verified_at: r.verified_at?.toISOString() || undefined,
          submitted_by: `${user.first_name} ${user.last_name}`,
          remittance_date: r.remittance_date.toISOString(),
          created_at: r.created_at.toISOString(),
        })),
        reconciliation: userReconciliations.map(r => ({
          run_id: r.id,
          actor: `${user.first_name} ${user.last_name}`,
          date: r.date.toISOString().split("T")[0],
          expected_float: Number(r.expected_float),
          actual_remittance: Number(r.actual_remittance),
          variance: Number(r.variance),
          status: r.status,
          scope: r.scope,
          generated_at: r.generated_at.toISOString(),
        })),
      };
    });

    return NextResponse.json({ success: true, data: mappedUsers });
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

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("PATCH /api/admin/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
