import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet, cacheInvalidate } from "@/app/lib/redis";

// GET /api/locations - Fetch all locations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;
    
    const cacheKey = `cache:locations:${company_id}`;
    
        // 1. Try cache first
    const cachedRules = await cacheGet(cacheKey);
    if (cachedRules) {
      return NextResponse.json(cachedRules);
    }

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

    // Invalidate the cache
    await cacheInvalidate(`cache:locations:${company_id}`);

    return NextResponse.json({ success: true, data: newLocation });
  } catch (error) {
    console.error("POST /api/locations error:", error);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}



export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN" || !session?.user.id) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }
    const { company_id } = session.user;
    const body = await req.json();
    const { id, name, address, opening_time, closing_time } = body;

    if (!id) {
      return NextResponse.json({ error: "Location ID is required" }, { status: 400 });
    }

    if (!name || !address) {
      return NextResponse.json({ error: "Location Name and Address are required" }, { status: 400 });
    }

    const location = await prisma.location.findFirst({
      where: { id, company_id }
    });

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        name,
        address,
        opening_time: opening_time || null,
        closing_time: closing_time || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "UPDATE",
        entity_type: "LOCATION",
        entity_id: id,
        before_state: JSON.stringify(location),
        after_state: JSON.stringify(updatedLocation),
        company_id,
      },
    });

    // Invalidate the cache
    await cacheInvalidate(`cache:locations:${company_id}`);

    return NextResponse.json({ success: true, data: updatedLocation });
  } catch (error) {
    console.error("PATCH /api/locations error:", error);
    return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
  }
}

