import { prisma } from "@/lib/prisma";
import { Roles } from "@prisma/client";
import crypto from "crypto";
import { AppError } from "./auth.service";




export async function createREGToken({
  role,
  issued_by,
}: {
  role: Roles;
  issued_by: string;
}) {
  const issuer = await prisma.user.findUnique({
    where: { id: issued_by },
  });

  if (!issuer) throw new AppError("Issuer not found", 404);

  if (issuer.role !== Roles.ADMIN && issuer.role !== Roles.SUPERVISOR) {
    throw new AppError("Not authorized to create token", 403);
  }

  const expires_at = new Date(Date.now() + 60 * 60 * 1000);

  let tokenRecord;

  // retry-safe token generation
  while (!tokenRecord) {
    const token = crypto.randomBytes(8).toString("hex").toUpperCase();

    try {
      tokenRecord = await prisma.registrationToken.create({
        data: {
          token,
          role,
          expires_at,
          issued_by,
        },
      });

      await prisma.registrationToken.deleteMany({
        where: {
          expires_at: {
            lt: new Date(),
          },
          is_used: false,
        },
      })
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
  issued_by,
  requester_id,
  requester_role,
}: {
  issued_by?: string;
  requester_id: string;
  requester_role: Roles;
}) {
  if (requester_role !== Roles.ADMIN && requester_role !== Roles.SUPERVISOR) {
    throw new AppError("Not authorized", 403);
  }

  const targetUser = issued_by ?? requester_id;

  const tokens = await prisma.registrationToken.findMany({
    where: {
      issued_by: targetUser,
      is_used: false,
      expires_at: {
        gt: new Date(),
      }
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