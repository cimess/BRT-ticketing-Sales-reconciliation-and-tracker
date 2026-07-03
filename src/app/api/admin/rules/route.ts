// src/app/api/admin/rules/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const rules = await prisma.companyRule.findMany({
      where: { company_id: session.user.company_id },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error("Failed to list rules:", error);
    return NextResponse.json({ error: "Failed to list rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, trigger, target_field, operator, comparison_value, fine_amount } = body;

    const newRule = await prisma.companyRule.create({
      data: {
        name,
        description,
        trigger,
        target_field,
        operator,
        comparison_value: parseFloat(comparison_value),
        fine_amount: parseFloat(fine_amount),
        company_id: session.user.company_id,
      },
    });

    return NextResponse.json({ success: true, data: newRule });
  } catch (error) {
    console.error("Failed to create rule:", error);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}
