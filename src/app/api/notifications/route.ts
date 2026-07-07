import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const companyId = session.user.company_id;

    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get("limit") || "20";
    const pageParam = searchParams.get("page") || "1";
    const filterReadParam = searchParams.get("unreadOnly"); // "true" or "false"

    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10)));
    const page = Math.max(1, parseInt(pageParam, 10));
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      user_id: userId,
      company_id: companyId,
    };

    if (filterReadParam === "true") {
      where.is_read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where,
      }),
      prisma.notification.count({
        where: { user_id: userId, company_id: companyId, is_read: false },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const companyId = session.user.company_id;
    const body = await req.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { user_id: userId, company_id: companyId, is_read: false },
        data: { is_read: true },
      });
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (!notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId, user_id: userId, company_id: companyId },
      data: { is_read: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
