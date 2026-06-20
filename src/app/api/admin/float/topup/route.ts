import { NextResponse } from "next/server";
import { addTopUp } from "@/server/services/topup.service";
import { addTopUpSchema } from "@/schemas/auth.schema";
import { ApiError } from "@/lib/ApiError";
import { ZodError } from "zod";
import { auth } from "@/auth";


export async function POST(req: Request) {
  try {

    const session= await auth()

    if(!session?.user?.id || !["ADMIN"].includes(session.user.role)){
      throw new ApiError(401,"Unauthorized" );
    }

    const user= session.user

    const body = await req.json();
    const meta = {
      ip: req.headers.get("x-forwarded-for") || "",
      user:{
        id:user.id||"",
        role:user.role as string||"USER",
        company_id:user.company_id as string,
      },
    };
    // 1. Parse and destructure the validated data
    let data;


    try {
      data = addTopUpSchema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        // 2. Destructure the field errors
        const fieldErrors = error.flatten().fieldErrors;
        
        // Grab the very first error message in the object to show the user
        // Example: "Amount must be at least 10000"
        const firstErrorMessage = Object.values(fieldErrors).flat()[0];
        
        throw new ApiError(400,firstErrorMessage as string||"Validation failed" );
      }
      throw error;
    }

    // 3. Destructure the clean, validated data directly
    if(!data) {
      throw new ApiError(400,"Invalid input provided" );
    }
    const { amount, allocated_from, allocationNote } = data;

    // 4. Pass the validated data into your service
    const result = await addTopUp(
      { 
        amount, 
        allocated_from, 
        allocationNote: allocationNote || "" 
      }, 
      meta
    );

    return NextResponse.json(result);
  } catch (error: unknown) {

    let errorMessage = error instanceof ApiError ? error?.message : "Something went wrong";
    const statusCode = error instanceof ApiError ? error?.statusCode : 500;
    if (statusCode === 500) {

      errorMessage = "Something went wrong";
    }
    return Response.json({ success: false, message: errorMessage }, { status: statusCode });
  }
}