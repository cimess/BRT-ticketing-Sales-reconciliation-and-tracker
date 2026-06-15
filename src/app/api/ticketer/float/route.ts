// src/app/api/ticketer/float/route.ts

import { NextResponse, NextRequest } from "next/server"; // Added NextRequest
import { auth } from "@/auth";
import { fetchTicketerPosSnapshot } from "@/app/server/services/getCompanyFloatSnapshot.service";

export async function GET(req: NextRequest) { // Updated signature
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TICKETER" && !session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");

    const fromDate = fromDateStr ? new Date(fromDateStr) : null;
    const toDate = toDateStr ? new Date(toDateStr) : null;

    const snapshot = await fetchTicketerPosSnapshot(session.user.id!, fromDate, toDate);

    if (!snapshot.success) {
      return NextResponse.json(
        { error: snapshot.message },
        { status: snapshot.status }
      );
    }
    
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("GET /api/ticketer/float error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
