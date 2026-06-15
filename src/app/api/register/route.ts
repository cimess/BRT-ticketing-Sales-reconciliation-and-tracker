import register from "@/app/server/services/auth.service";
import { registerSchema } from "@/schemas/auth.schema";
import { AppError } from "@/app/server/services/auth.service";

export async function POST(req: Request) {

  try {
    const body = await req.json();
    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      const message = Object.values(validation.error.flatten().fieldErrors)
        .flat()
        .join(", ");
      return Response.json({ success: false, message: message }, { status: 400 });
    }
    const res = await register(validation.data);


    return Response.json({
      success: res.success,
      message: res.message,
      user: res.user,
    });
  } catch (error) {
    let errorMessage = error instanceof AppError ? error.message : "Something went wrong";
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    if (statusCode === 500) {

      console.log(error, "this is the error message")
      errorMessage = "Something went wrong";
    }
    return Response.json({ success: false, message: errorMessage }, { status: statusCode });
  }
}