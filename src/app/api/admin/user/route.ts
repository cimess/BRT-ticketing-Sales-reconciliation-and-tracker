// src/app/api/admin/user/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";

// 1. FETCH USERS
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    // Only authenticated users can fetch the list
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // You can optionally pass a role in the URL like /api/admin/user?role=SUPERVISOR
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role");

const whereCondition: Record<string, string> = {};
    
    if (roleFilter) {
      whereCondition.role = roleFilter;
    }

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        restricted: true,
        supervisor_id: true,
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /api/admin/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// 2. RESTRICT (BAN) OR UNRESTRICT A USER
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    
    // SECURITY: Only Admins can restrict users!
    if (!session?.user || session.user.role !== "ADMIN"||!session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Only Admins can restrict users." }, { status: 403 });
    }

    const body = await req.json();
    const { user_id, restricted } = body;

    if (!user_id || typeof restricted !== "boolean") {
      return NextResponse.json({ error: "Missing user_id or restricted status" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user_id },
      data: { restricted: restricted },
    });

    // Log the security action
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "UPDATE",
        entity_type: "USER",
        entity_id: user_id,
        after_state: updatedUser,
      }
    });

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("PATCH /api/admin/user error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
