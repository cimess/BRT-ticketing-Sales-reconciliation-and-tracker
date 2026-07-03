// src/app/api/admin/commissions/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Roles } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const commissionRules = await prisma.commission_rules.findMany({
      where: { company_id: session.user.company_id },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ success: true, data: commissionRules });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list commissions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { role, percentage, fixed_amount } = body;

    // Use upsert or find first to avoid duplicate rates per role
    const existingRule = await prisma.commission_rules.findFirst({
      where: { role: role as Roles, company_id: session.user.company_id },
    });

    let savedRule;
    if (existingRule) {
      savedRule = await prisma.commission_rules.update({
        where: { id: existingRule.id },
        data: {
          percentage: percentage !== null ? parseFloat(percentage) : null,
          fixed_amount: fixed_amount !== null ? parseFloat(fixed_amount) : null,
        },
      });
    } else {
      savedRule = await prisma.commission_rules.create({
        data: {
          role: role as Roles,
          percentage: percentage !== null ? parseFloat(percentage) : null,
          fixed_amount: fixed_amount !== null ? parseFloat(fixed_amount) : null,
          company_id: session.user.company_id,
        },
      });
    }

    return NextResponse.json({ success: true, data: savedRule });
  } catch (error) {
    console.error("Failed to save commission:", error);
    return NextResponse.json({ error: "Failed to save commission" }, { status: 500 });
  }
}
