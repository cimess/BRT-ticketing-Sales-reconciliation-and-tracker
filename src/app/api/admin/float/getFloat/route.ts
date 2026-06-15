// src/app/api/admin/float/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRoleFinancialSnapshot } from "@/app/server/services/getCompanyFloatSnapshot.service";
import { ApiError } from "@/lib/ApiError";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user||!session.user.role||!session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const floatData = await getRoleFinancialSnapshot(session.user.role, session.user.id);

    return NextResponse.json(floatData);
  } catch (error) {
    console.error("GET /api/admin/float error:", error);
  if (error instanceof ApiError) {
  return NextResponse.json({ error: error.message }, { status: error.statusCode });
}
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
