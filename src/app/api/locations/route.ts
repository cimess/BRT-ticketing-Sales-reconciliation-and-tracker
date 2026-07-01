import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/locations - Fetch all locations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;

    const locations = await prisma.location.findMany({
      where: { company_id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: locations });
  } catch (error) {
    console.error("GET /api/locations error:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}


// POST /api/locations - Add new location (ADMIN only)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN" || !session?.user.id) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }
    const { company_id } = session.user;
    const body = await req.json();
    const { name, address, opening_time, closing_time } = body;

    if (!name || !address) {
      return NextResponse.json({ error: "Location Name and Address are required" }, { status: 400 });
    }

    const newLocation = await prisma.location.create({
      data: {
        name,
        address,
        company_id,
        opening_time: opening_time || null,
        closing_time: closing_time || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "CREATE",
        entity_type: "LOCATION",
        entity_id: newLocation?.id,
        after_state: JSON.stringify(newLocation),
        company_id,
      },
    });

    return NextResponse.json({ success: true, data: newLocation });
  } catch (error) {
    console.error("POST /api/locations error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}

