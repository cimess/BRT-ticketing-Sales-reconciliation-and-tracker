import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fine_status, Prisma } from "@prisma/client";
import { ApiError } from "@/app/lib/ApiError";

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

    if (!defaulterId || !amount || Number(amount) <= 0 || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const defaulter = await prisma.user.findFirst({
      where: { id: defaulterId, company_id }
    });
    if (!defaulter) {
      return NextResponse.json({ error: "Defaulter user not found in this company" }, { status: 404 });
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



export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: callerId, role, company_id } = session.user;
    const { id: fineId } = await params;

    const body = await req.json();
    const { action } = body; // "PAY" or "VOID"

    if (!["PAY", "VOID"].includes(action)) {
      return NextResponse.json({ error: "Invalid action. PAY or VOID allowed." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const fine = await tx.fine.findUnique({
        where: { id: fineId, company_id }
      });

      if (!fine) throw new ApiError(404, "Fine not found");
      if (fine.status !== "UNPAID") {
        throw new ApiError(400, `Fine cannot be updated because it is already ${fine.status}`);
      }

      let updatedFine;

      if (action === "PAY") {
        if (role === "TICKETER" && fine.defaulter_id !== callerId) {
          throw new ApiError(403, "You can only pay your own fines");
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { status: "PAID" }
        });

        // credit company cash box and reduce debt ledger
        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: "COMPANY_ACCOUNT",
            account_type: "COMPANY",
            amount: Number(fine.amount),
            entry_type: "CREDIT",
            reference_type: "FINE_PAYMENT",
            reference_id: fine.id,
            description: `Fine payment settled for User ${fine.defaulter_id}`,
          }
        });

        await tx.companyFloat.upsert({
          where: { id: "COMPANY_ACCOUNT", company_id },
          update: { available_balance: { increment: Number(fine.amount) } },
          create: { id: "COMPANY_ACCOUNT", company_id, available_balance: Number(fine.amount) }
        });

        await tx.float_Ledger.create({
          data: {
            company_id,
            account_id: fine.defaulter_id,
            account_type: "TICKETER",
            amount: Number(fine.amount),
            entry_type: "CREDIT",
            reference_type: "FINE_PAYMENT",
            reference_id: fine.id,
            description: `Fine payment confirmed. Debt reduced.`,
          }
        });

      } else if (action === "VOID") {
        if (role !== "ADMIN" && fine.issued_by !== callerId) {
          throw new ApiError(403, "Only admins or issuing supervisors can waive this fine");
        }

        updatedFine = await tx.fine.update({
          where: { id: fineId },
          data: { status: "WAIVED" }
        });
      }

      await tx.auditLog.create({
        data: {
          company_id,
          user_id: callerId,
          action: "UPDATE",
          entity_type: "FINE",
          entity_id: fine.id,
          before_state: fine,
          after_state: updatedFine
        }
      });

      return updatedFine;
    });

    return NextResponse.json({ success: true, fine: result });
  } catch (error) {
    console.error("PATCH /api/fines/[id] error:", error);
    return NextResponse.json({
      error: error instanceof ApiError ? error.message : "Internal Server Error"
    }, { status: error instanceof ApiError ? error.statusCode : 500 });
  }
}
