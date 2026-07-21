import { createREGToken, getTokens } from "@/server/services/regtrationtokenGen.service";
import { ApiError } from "@/lib/ApiError";
import { createREGTokenSchema } from "@/schemas/auth.schema";
import { auth } from "@/auth";
import { Roles } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new ApiError(401, "User not authenticated");
    }

    const body = await req.json();

    const validation = createREGTokenSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(
        400,
        validation.error.flatten().fieldErrors.role?.join(", ") || "Invalid data"
      );
    }

    const { role } = validation.data;

    const result = await createREGToken({
      role,
      issued_by: session.user.id,
      companyId: session.user.company_id,
    });

    return Response.json({
      success: true,
      message: result.message,
      token: result.token,
    });
  } catch (error) {
    // 1. Log the error to Vercel console so you can see it in logs
    console.error("POST /api/regtoken error:", error); 
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    // 2. Return the actual error message to the browser network response
    const message = error instanceof ApiError 
      ? error.message 
      : (error instanceof Error && statusCode!==500? error.message : "Something went wrong");
    return Response.json(
      { success: false, message },
      { status: statusCode }
    );
  }

}

export async function GET(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new ApiError(401, "User not authenticated");
    }

    const { searchParams } = new URL(req.url);
    const issued_by = searchParams.get("issued_by") ?? undefined;

    const result = await getTokens({
      companyId: session.user.company_id,
      issued_by,
      requester_id: session.user.id,
      requester_role: session.user.role as Roles,
    });

    return Response.json({
      success: true,
      message: result.message,
      tokens: result.tokens,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message = error instanceof ApiError ? error.message : "Something went wrong";

    return Response.json(
      { success: false, message },
      { status: statusCode }
    );
  }
}
