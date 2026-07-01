// src/app/api/remitance/[id]/accept/route.ts
// only for supervisor
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/app/lib/ApiError";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Only supervisors can accept cash handovers" }, { status: 403 });
    }

    const { action } = await req.json(); // 'ACCEPT' | 'REJECT'
    const param=await params
    const remittanceId = param.id;

    const updated = await prisma.$transaction(async (tx) => {
      const remit = await tx.remittance.findUnique({ where: { id: remittanceId } });
      if (!remit) throw new ApiError(404,"Remittance not found");
      if (remit.status !== "PENDING_SUPERVISOR_ACCEPTANCE") {
        throw new ApiError(400,"Remittance is not awaiting supervisor acceptance");
      }

      const newStatus = action === "ACCEPT" ? "ACCEPTED_BY_SUPERVISOR" : "REJECTED_BY_SUPERVISOR";

      return await tx.remittance.update({
        where: { id: remittanceId },
        data: {
          status: newStatus,
          verified_at: new Date(),
        }
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof ApiError ? err.message : 'An error occurred' }, { status: 400 });
  }
}



export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    // 1. Authorization Check: Only Supervisors (or Admins) can fetch targeted remittances
    if (!session?.user?.id || !["SUPERVISOR", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only supervisors can access remittance acceptance requests" },
        { status: 403 }
      );
    }

    const supervisorId = session.user.id;
    const companyId = session.user.company_id;

    // 2. Parse Query Parameters
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status"); // e.g., 'PENDING_SUPERVISOR_ACCEPTANCE' or 'ALL'
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 50;
    const skip = (page - 1) * limit;

    // 3. Build Where Filter
    // By default, fetch PENDING_SUPERVISOR_ACCEPTANCE unless specified
    const statusFilter = statusParam && statusParam !== "ALL" 
      ? statusParam 
      : "PENDING_SUPERVISOR_ACCEPTANCE";

    const where: Record<string, unknown> = {
      company_id: companyId,
      received_by_supervisor_id: supervisorId,
    };

    if (statusFilter !== "ALL") {
      where.status = statusFilter;
    }

    // 4. Query Database
    const [total, remittances] = await Promise.all([
      prisma.remittance.count({ where }),
      prisma.remittance.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        include: {
          ticketer: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              role: true,
            },
          },
          pos_session: {
            select: {
              id: true,
              device: {
                select: {
                  id: true,
                  name: true,
                  serial_number: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // 5. Format Response for Frontend Components
    const data = remittances.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      method: r.method,
      status: r.status,
      payment_reference: r.payment_reference,
      remittance_date: r.remittance_date.toISOString(),
      created_at: r.created_at.toISOString(),
      verified_at: r.verified_at ? r.verified_at.toISOString() : null,
      submitted_by: `${r.ticketer.first_name} ${r.ticketer.last_name}`,
      ticketer: {
        id: r.ticketer.id,
        first_name: r.ticketer.first_name,
        last_name: r.ticketer.last_name,
        role: r.ticketer.role,
      },
      pos_session_id: r.pos_session_id,
      pos_session: r.pos_session
        ? {
            id: r.pos_session.id,
            device: r.pos_session.device ? { name: r.pos_session.device.name } : null,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/remitance/supervisor/accept error:", error);
    return NextResponse.json(
      { error: error instanceof ApiError ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
