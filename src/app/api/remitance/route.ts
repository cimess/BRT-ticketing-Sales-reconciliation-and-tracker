// src/app/api/remitance/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.id;
    const role = session.user.role;
    
    if (role === "ADMIN" || role === "AUDITOR") {
      return NextResponse.json({ error: "Admins cannot submit remittances." }, { status: 403 });
    }

    const body = await req.json();
    const ip=req.headers.get('x-forwarded-for') || "Unknown";
    const { amount, method, payment_reference, remittance_date, ticketer_id, supervisor_id } = body;

    if (!amount || !method || !remittance_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let targetUserId = userId; 
    let receivedBySupId = null;

    // 💡 1. Ticketer hands cash to Supervisor
    if (role === "TICKETER" && method === "CASH" && supervisor_id) {
      receivedBySupId = supervisor_id;
    }

    // 💡 2. Supervisor Actions
    if (role === "SUPERVISOR") {
      if (ticketer_id) {
        // Supervisor logs cash received FROM a ticketer
        targetUserId = ticketer_id; 
        receivedBySupId = userId;
      } else {
        // Supervisor is remitting their OWN accumulated cash to the company!
        targetUserId = userId;
        receivedBySupId = null; 
      }
    }

    const newRemittance = await prisma.remittance.create({
      data: {
        submitted_by: targetUserId,
        received_by_supervisor_id: receivedBySupId,
        amount: amount,
        method: method,
        payment_reference: payment_reference || null,
        remittance_date: new Date(remittance_date),
        status: "PENDING",
      }
    });

    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action: "CREATE",
        entity_type: "REMITTANCE",
        entity_id: newRemittance.id,
        after_state: newRemittance,
      }
    });

    return NextResponse.json({ success: true, data: newRemittance });
  } catch (error) {
    console.error("POST /api/remittance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ... Keep your existing GET function here exactly as it is!


// src/app/api/remitance/route.ts — Updated GET handler

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const { id: userId, role } = session.user;

    // 1️⃣ Parse optional date query params
    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // 2️⃣ Build date filter (only if BOTH are provided, otherwise default to today)
    let dateFilter: Record<string, unknown> = {};

    if (fromParam && toParam) {
      // User explicitly selected a date range
      dateFilter = {
        remittance_date: {
          gte: new Date(fromParam),
          lte: new Date(toParam),
        }
      };
    } else {
      // DEFAULT: Today (start of day → end of day in user's timezone)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      dateFilter = {
        remittance_date: {
          gte: todayStart,
          lte: todayEnd,
        }
      };
    }
    
    // 3️⃣ Build role-based WHERE clause (keep your existing logic)
    let roleFilter: Record<string, unknown> = {};
    if (role === "TICKETER") {
      roleFilter = { submitted_by: userId };
    } else if (role === "SUPERVISOR") {
      const ticketers = await prisma.user.findMany({ 
        where: { supervisor_id: userId }, 
        select: { id: true } 
      });
      const ids = ticketers.map(t => t.id);
      ids.push(userId); 
      roleFilter = { submitted_by: { in: ids } };
    }
    // ADMIN sees all — no roleFilter needed

    // 4️⃣ Combine filters
    const where = { ...roleFilter, ...dateFilter };

    const remittances = await prisma.remittance.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        ticketer: { select: { first_name: true, last_name: true } },
        supervisor_receiver: { select: { first_name: true, last_name: true } }
      }
    });

    const mapped = remittances.map(r => ({
      id: r.id,
      amount: Number(r.amount),
      method: r.method,
      status: r.status,
      payment_reference: r.payment_reference,
      // 👇 NEW: Separate field for supervisor who received cash
      received_by_supervisor: r.supervisor_receiver 
        ? `${r.supervisor_receiver.first_name} ${r.supervisor_receiver.last_name}` 
        : null,
      remittance_date: r.remittance_date.toISOString(),
      created_at: r.created_at.toISOString(),
      submitted_by: `${r.ticketer.first_name} ${r.ticketer.last_name}`,
      verified_at: r.verified_at ? r.verified_at.toISOString() : null,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    console.error("GET /api/remittance error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

