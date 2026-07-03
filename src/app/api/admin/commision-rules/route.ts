// src/app/api/admin/commission-rules/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Roles } from "@prisma/client";

// Get active commission rules
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await prisma.commission_rules.findMany({
      where: { company_id: session.user.company_id }
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Create or update a commission rule for a role
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const companyId = session.user.company_id;

    const body = await req.json();
    const { role, percentage, fixedAmount } = body;

    if (!role || (!percentage && !fixedAmount)) {
      return NextResponse.json({ error: "Invalid payload. Specify percentage and/or fixedAmount." }, { status: 400 });
    }

    // Deactivate previous active rules for this role
    await prisma.commission_rules.updateMany({
      where: { company_id: companyId, role: role as Roles, is_active: true },
      data: { is_active: false }
    });

    // Create the new rule
    const newRule = await prisma.commission_rules.create({
      data: {
        company_id: companyId,
        role: role as Roles,
        percentage: percentage ? parseFloat(percentage) : null,
        fixed_amount: fixedAmount ? parseFloat(fixedAmount) : null,
        is_active: true
      }
    });

    return NextResponse.json({ success: true, rule: newRule });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
