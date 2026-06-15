import { createREGToken, getTokens } from "@/app/server/services/regtrationtokenGen.service";
import { ApiError } from "@/lib/ApiError";
import { createREGTokenSchema, getTokensSchema } from "@/schemas/auth.schema";
import { auth } from "@/auth";
import { Roles } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new ApiError(401,"User not authenticated" );
    }

    const body = await req.json();

    const validation = createREGTokenSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400,validation.error.flatten().fieldErrors.role?.join(", ") ||
        "Invalid data"
      );
    }

    const { role } = validation.data;

    const result = await createREGToken({
      role,
      issued_by: session.user.id,
    });

    return Response.json({
      success: true,
      message: result.message,
      token: result.token,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    const message =
      error instanceof ApiError ? error.message : "Something went wrong";

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
      throw new ApiError(401,"User not authenticated" );
    }

    const { searchParams } = new URL(req.url);
    const issued_by = searchParams.get("issued_by") ?? undefined;

    const result = await getTokens({
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
    const message =
      error instanceof ApiError ? error.message : "Something went wrong";

    return Response.json(
      { success: false, message },
      { status: statusCode }
    );
  }
}
