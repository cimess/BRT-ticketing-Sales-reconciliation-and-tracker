// src/app/api/remitance/upload-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/app/lib/r2";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contentType, fileName } = await req.json();
    if (!contentType || !fileName) {
      return NextResponse.json({ error: "contentType and fileName are required" }, { status: 400 });
    }

    const companyId = session.user.company_id;
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueId = crypto.randomUUID();

       // Check if development or production
    const isProd = process.env.NODE_ENV === "production" || process.env.MODE === "production";
    const tempPrefix = isProd ? "tmp" : "dev_tmp";
    
    // Organize files by company id and suffix with random UUIDs to avoid name collision
    const key = `${tempPrefix}/${companyId}/${uniqueId}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    // URL expires in 5 minutes
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 });

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
    });
  } catch (error) {
    console.error("Error generating presigned PUT URL:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
