// src/app/api/supervisor/topup/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";
import { ApiError } from "next/dist/server/api-utils";

export async function GET(req: NextRequest) { // Updated signature
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    // 1. Fetch active sessions for dropdown selection
    const activeSessions = await prisma.posDeviceSession.findMany({
      where: {
        status: "ACTIVE"
      },
      include: {
        user: { select: { id: true, first_name: true, last_name: true } },
        device: { select: { name: true } }
      }
    });

    // Construct the date range filtering where object
    const whereClause: Prisma.Float_allocationsWhereInput = {};
    if (fromDate || toDate) {
      whereClause.allocated_at = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) }),
      };
    }

    // 2. Fetch history of POS float allocations filtered by date
    const history = await prisma.float_allocations.findMany({
      where: whereClause, // Apply the date filters here
      orderBy: {
        allocated_at: "desc"
      },
      include: {
        supervisor: {
          select: {
            first_name: true,
            last_name: true,
            role: true
          }
        },
        pos_device: {
          include: {
            user: { select: { first_name: true, last_name: true } },
            device: { select: { name: true } }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      sessions: activeSessions.map(s => ({
        id: s.id,
        deviceName: s.device.name,
        ticketerId: s.user.id,
        ticketerName: `${s.user.first_name || ""} ${s.user.last_name || ""}`.trim(),
        currentFloat: Number(s.pos_float)
      })),
      history: history.map(h => ({
        id: h.id,
        top_up_id: h.id,
        from_user: `${h.supervisor.first_name || ""} ${h.supervisor.last_name || ""}`.trim(),
        from_role: h.supervisor.role,
        to_user: `${h.pos_device.user.first_name || ""} ${h.pos_device.user.last_name || ""} (${h.pos_device.device.name || "Unknown"})`.trim(),
        to_role: "TICKETER",
        amount_allocated: Number(h.amount_allocated),
        amount_remaining: Number(h.amount_allocated),
        status: h.status,
        allocated_at: h.allocated_at.toISOString()
      }))
    });
  } catch (error) {
    console.error("GET /api/supervisor/topup error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


// POST endpoint code remains exactly the same...


export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== "SUPERVISOR" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { posSessionId, amount } = await req.json();

    if (!posSessionId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const allocationAmount = new Prisma.Decimal(amount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Get and verify company float
      const companyFloat = await tx.companyFloat.findUnique({
        where: { id: "COMPANY_ACCOUNT" }
      });

      if (!companyFloat || companyFloat.available_balance.lt(allocationAmount)) {
        throw new ApiError(400,"Insufficient company float available to allocate.")
      }

      // 2. Verify target POS session exists and is active
      const posSession = await tx.posDeviceSession.findUnique({
        where: { id: posSessionId }
      });

      if (!posSession || posSession.status !== "ACTIVE") {
        throw new ApiError(400,"Target POS session is not active or does not exist.")
      }

      // 3. Decrement Company Float
      const updatedCompanyFloat = await tx.companyFloat.update({
        where: { id: "COMPANY_ACCOUNT" },
        data: {
          available_balance: {
            decrement: allocationAmount
          }
        }
      });

      // 4. Increment POS session float
    await tx.posDeviceSession.update({
        where: { id: posSessionId },
        data: {
          pos_float: {
            increment: allocationAmount
          }
        }
      });

      // 5. Create Float Allocation record
      const allocation = await tx.float_allocations.create({
        data: {
          from_user: session.user.id!,
          pos_device_id: posSessionId,
          amount_allocated: allocationAmount,
          status: "SUCCESS"
        }
      });

      // 6. Create Debit entry in Company Ledger
      await tx.float_Ledger.create({
        data: {
          account_id: "COMPANY_ACCOUNT",
          account_type: "COMPANY",
          amount: allocationAmount,
          entry_type: "DEBIT",
          reference_type: "ALLOCATION",
          reference_id: allocation.id,
          description: `Float allocated to POS session ${posSessionId} by Supervisor`
        }
      });

      // 7. Create Credit entry in POS Ledger
      await tx.float_Ledger.create({
        data: {
          account_id: posSessionId,
          account_type: "POS_DEVICE",
          posSession: posSessionId,
          amount: allocationAmount,
          entry_type: "CREDIT",
          reference_type: "ALLOCATION",
          reference_id: allocation.id,
          description: `Float received from Supervisor`
        }
      });

      return {
        allocation,
        availableCompanyBalance: Number(updatedCompanyFloat.available_balance)
      };
    });

    return NextResponse.json({
      success: true,
      message: "Float allocated successfully",
      data: result
    });
  } catch (error) {
    console.error("POST /api/supervisor/topup error:", error);
    return NextResponse.json({ 
      success: false, 
      message:"Internal Server Error" 
    }, { status: 400 });
  }
}
