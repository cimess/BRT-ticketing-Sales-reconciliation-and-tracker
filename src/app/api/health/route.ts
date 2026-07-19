import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Run a fast, lightweight query to wake up/keep-alive the database
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "healthy", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "unhealthy", error: "Database connection failed" },
      { status: 500 }
    );
  }
}
