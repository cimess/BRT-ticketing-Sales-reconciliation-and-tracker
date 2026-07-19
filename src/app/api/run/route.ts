import { exec } from "child_process";
import { NextResponse } from "next/server";
import { promisify } from "util";
import { ApiError } from "@/app/lib/ApiError";

const execPromise = promisify(exec);

export async function GET() {
  try {
    // Run the migration command inside Vercel
    const { stdout, stderr } = await execPromise("npx prisma migrate deploy");
    
    return NextResponse.json({
      status: "success",
      message: "Migrations applied successfully!",
      stdout,
      stderr,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      const message = err.message;
      const statusCode = err.statusCode;
      return NextResponse.json(
        {
          status: "failed",
          error: {message},
          statusCode,

        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      {
        status: "failed",
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
