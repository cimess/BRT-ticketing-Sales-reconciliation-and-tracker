// src/app/api/admin/commissions/[id]/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { is_active } = body;

    const updated = await prisma.commission_rules.update({
      where: { id: params.id, company_id: session.user.company_id },
      data: { is_active },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update commission" }, { status: 500 });
  }
}
