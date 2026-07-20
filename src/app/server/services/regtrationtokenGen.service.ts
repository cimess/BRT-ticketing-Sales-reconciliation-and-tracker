import { prisma } from "@/lib/prisma";
import { Roles } from "@prisma/client";
import crypto from "crypto";
import { ApiError } from "@/lib/ApiError";




export async function createREGToken({
  role,
  issued_by,
  companyId
}: {
  role: Roles;
  issued_by: string;
  companyId:string
}) {
  const issuer = await prisma.user.findUnique({
    where: { id: issued_by,company_id:companyId },
  });

  if (!issuer) throw new ApiError(404,"Issuer not found");

  if (issuer.role !== Roles.ADMIN && issuer.role !== Roles.SUPERVISOR) {
    throw new ApiError(403,"Not authorized to create token");
  }

  const expires_at = new Date(Date.now() + 60 * 60 * 1000);

  let tokenRecord;

  // retry-safe token generation
  while (!tokenRecord) {
    const token = crypto.randomBytes(8).toString("hex").toUpperCase();

    try {
      tokenRecord = await prisma.registrationToken.create({
        data: {
          company_id:companyId,
          token,
          role,
          expires_at,
          issued_by,
        },
      });

    } catch (e) {
      // collision rare — retry
      tokenRecord = null;
    }
  }

  // optional: audit log here

  return {
    success: true,
    message: "Token created successfully",
    token: tokenRecord.token,
  };
}

export async function getTokens({
  companyId,
  issued_by,
  requester_id,
  requester_role,
}: {
  issued_by?: string;
  requester_id: string;
  requester_role: Roles;
  companyId: string;
}) {
  if (requester_role !== Roles.ADMIN && requester_role !== Roles.SUPERVISOR) {
    throw new ApiError(403,"Not authorized");
  }
  if(!companyId){
    throw new ApiError(400,"Company ID is required");
  }
  const tokens = await prisma.registrationToken.findMany({
    where: {
      company_id: companyId,
      is_used: false,
      expires_at: {
        gt: new Date(),
      },
      // 💡 Conditionally add issued_by filter if it is provided
      ...(issued_by ? { issued_by } : {}),
    },
    orderBy: {
      created_at: "desc",
    },
  });
  return {
    success: true,
    message: "Tokens fetched successfully",
    tokens,
  };
}