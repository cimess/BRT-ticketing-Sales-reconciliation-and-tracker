// src/app/api/remitance/[id]/images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME } from "@/app/lib/r2";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const companyId = session.user.company_id;

    // Fetch the remittance and ensure company matches for security isolation
    const remittance = await prisma.remittance.findFirst({
      where: { company_id: companyId,id },
      select: { receipt_images: true },
    });

    if (!remittance) {
      return NextResponse.json({ error: "Remittance record not found" }, { status: 404 });
    }

    if (!remittance.receipt_images || remittance.receipt_images.length === 0) {
      return NextResponse.json({ success: true, images: [] });
    }

    // Generate secure links (one for viewing, one that forces attachment downloading)
    const images = await Promise.all(
      remittance.receipt_images.map(async (key) => {
        const fileName = key.split("/").pop() || "receipt.jpg";

        // View Link Command
        const viewCommand = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
        });

        // Forced Download Link Command
        const downloadCommand = new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${fileName}"`,
        });

        const viewUrl = await getSignedUrl(r2Client, viewCommand, { expiresIn: 900 });
        const downloadUrl = await getSignedUrl(r2Client, downloadCommand, { expiresIn: 900 });

        return {
          key,
          fileName,
          viewUrl,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({ success: true, images });
  } catch (error) {
    console.error("Error generating presigned URLs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
