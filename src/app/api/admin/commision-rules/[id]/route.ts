// src/app/api/admin/commision-rules/[id]/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    const { is_active } = body;

    // Fetch current rule to know its target role
    const currentRule = await prisma.commission_rules.findFirst({
      where: { id, company_id: session.user.company_id }
    });

    if (!currentRule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    // If activating this rule, deactivate other active rules for the same role
    if (is_active === true) {
      await prisma.commission_rules.updateMany({
        where: {
          company_id: session.user.company_id,
          role: currentRule.role,
          id: { not: id }
        },
        data: { is_active: false }
      });
    }

    const updated = await prisma.commission_rules.update({
      where: { id, company_id: session.user.company_id },
      data: { is_active },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT commission-rules/[id] error:", error);
    return NextResponse.json({ error: "Failed to update commission" }, { status: 500 });
  }
}
