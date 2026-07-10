// src/app/api/reports/[id]/download/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/prisma";
import { r2Client, R2_BUCKET_NAME } from "@/app/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(
  req: NextRequest,
  {params}: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { company_id } = session.user;
    
    // In Next.js 15, route params on the context object are a Promise and must be awaited
    const { id: reportTaskId } = await params;

    // Fetch the task
    const task = await prisma.reportTask.findFirst({
      where: { id: reportTaskId, company_id }
    });

    if (!task) {
      return NextResponse.json({ error: "Report not found or access denied" }, { status: 404 });
    }

    if (task.status !== "READY" || !task.storage_key) {
      return NextResponse.json({ error: "Report is not ready for download" }, { status: 400 });
    }

    // Generate AWS S3/R2 presigned URL valid for 15 minutes (900 seconds)
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: task.storage_key,
      ResponseContentDisposition: `attachment; filename="${task.name.replace(/[^a-zA-Z0-9]/g, "_")}.${task.format.toLowerCase()}"`
    });

    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    return NextResponse.json({ success: true, url: presignedUrl });
  } catch (error) {
    console.error("GET /api/reports/[id] error:", error);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}
