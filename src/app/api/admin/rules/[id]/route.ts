// src/app/api/admin/rules/[id]/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { is_active, comparison_value, fine_amount } = body;

    const data: Prisma.CompanyRuleUpdateInput = {};
    if (is_active !== undefined) data.is_active = is_active;
    if (comparison_value !== undefined) data.comparison_value = parseFloat(comparison_value);
    if (fine_amount !== undefined) data.fine_amount = parseFloat(fine_amount);

    const updated = await prisma.companyRule.update({
      where: { id, company_id: session.user.company_id },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT rules/[id] error:", error);
    return NextResponse.json({ error: "Failed to update rule status" }, { status: 500 });
  }
}


