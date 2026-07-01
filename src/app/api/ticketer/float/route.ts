// src/app/api/ticketer/float/route.ts

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { fetchTicketerPosSnapshot } from "@/server/services/getCompanyFloatSnapshot.service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TICKETER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { company_id } = session.user;
    const { searchParams } = new URL(req.url);
    const fromDateStr = searchParams.get("fromDate");
    const toDateStr = searchParams.get("toDate");
    const sessionId = searchParams.get("sessionId");

    const fromDate = fromDateStr ? new Date(fromDateStr) : null;
    const toDate = toDateStr ? new Date(toDateStr) : null;

    const snapshot = await fetchTicketerPosSnapshot(
      session.user.id!,
      company_id,
      fromDate,
      toDate,
      sessionId
    );

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
