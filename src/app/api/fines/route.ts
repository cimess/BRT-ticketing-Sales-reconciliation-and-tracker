import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fine_status, Prisma } from "@prisma/client";
import { ApiError } from "@/app/lib/ApiError";
import { checkSupervisorFinePermission } from "@/app/server/services/rules.service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId, role, company_id } = session.user;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const where:Prisma.FineWhereInput= { company_id };
    if (statusFilter) where.status = statusFilter as fine_status

    if (role === "TICKETER") {
      where.defaulter_id = userId;
    } else if (role === "SUPERVISOR") {
      const supervisedUsers = await prisma.user.findMany({
        where: { supervisor_id: userId, company_id },
        select: { id: true }
      });
      const supervisedIds = supervisedUsers.map(u => u.id);
      where.OR = [
        { issued_by: userId },
        { defaulter_id: userId }, 
        { defaulter_id: { in: supervisedIds } }
      ];
    }


    const fines = await prisma.fine.findMany({
      where,
      include: {
        defaulter: { select: { first_name: true, last_name: true, role: true } },
        issuer: { select: { first_name: true, last_name: true, role: true } }
      },
      orderBy: { created_at: "desc" }
    });

    return NextResponse.json({ success: true, fines });
  } catch (error) {
    console.error("GET /api/fines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: callerId, role, company_id } = session.user;
    if (role !== "ADMIN" && role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Only admins and supervisors can issue fines" }, { status: 403 });
    }

    const body = await req.json();
    const { defaulterId, amount, reason } = body;

    const defaulter = await prisma.user.findFirst({
      where: { id: defaulterId, company_id }
    });
    if (!defaulter) {
      return NextResponse.json({ error: "Defaulter user not found in this company" }, { status: 404 });
    }

    // ENFORCE SUPERVISOR HIERARCHY & PERMISSION
    if (role === "SUPERVISOR") {
  const hasPermission = await checkSupervisorFinePermission(company_id);
  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden: Supervisors do not have permission to issue fines." }, { status: 403 });
  }
  if (defaulter.role !== "TICKETER" || defaulter.supervisor_id !== callerId) {
    return NextResponse.json({ 
      error: "Supervisors can only issue fines to ticketers under their direct supervision" 
    }, { status: 403 });
  }
}


    const fine = await prisma.fine.create({
      data: {
        company_id,
        defaulter_id: defaulterId,
        issued_by: callerId,
        amount: Number(amount),
        reason,
        status: "UNPAID"
      }
    });

    await prisma.auditLog.create({
      data: {
        company_id,
        user_id: callerId,
        action: "CREATE",
        entity_type: "FINE",
        entity_id: fine.id,
        after_state: fine 
      }
    });

    return NextResponse.json({ success: true, fine });
  } catch (error) {
    console.error("POST /api/fines error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}




