import { verifyRegToken } from "@/server/services/auth.service";
import { verifyTokenSchema } from "@/schemas/auth.schema";
import { ApiError } from "@/lib/ApiError";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.company_code && !body.companyCode) {
      body.companyCode = body.company_code;
    }
    const validation = verifyTokenSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400,validation.error.flatten().fieldErrors.token?.join(", ") || "Invalid data");
    }


    const res = await verifyRegToken(validation.data);


    return Response.json({
      success: res.success,
      message: res.message,
      role: res.role,
    });
  } catch (error) {

    let errorMessage = error instanceof ApiError ? error.message : "Something went wrong";
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    if (statusCode === 500) {
      errorMessage = "Something went wrong";
      console.log(errorMessage, "this is the error message")
    }
    return Response.json({ success: false, message: errorMessage }, { status: statusCode });
  }
}