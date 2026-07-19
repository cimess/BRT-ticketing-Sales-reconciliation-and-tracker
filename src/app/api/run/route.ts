import { exec } from "child_process";
import { NextResponse } from "next/server";
import { promisify } from "util";

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
  } catch (err: unknown) {
    // Expose the actual shell execution error so we can read the Prisma engine output
    return NextResponse.json(
      {
        status: "failed",
        error: (err as unknown as { message: string }).message || String(err),
        stderr: (err as unknown as { stderr: string }).stderr || null,
        stdout: (err as unknown as { stdout: string }).stdout || null,
      },
      { status: 500 }
    );
  }
}
