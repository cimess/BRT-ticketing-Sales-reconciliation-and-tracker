import { NextResponse } from "next/server";
import { recordCompanyExpense } from "@/server/services/companyFloat.service";
import { ApiError } from "@/lib/ApiError";
import { auth } from "@/auth";
import { z } from "zod";

const schema = z.object({
  amount: z.coerce.number().min(1, "Amount must be greater than 0"),
  note: z.string().min(1, "Expense note is required")
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !["ADMIN"].includes(session.user.role)) {
      throw new ApiError(401, "Unauthorized");
    }

    const body = await req.json();
    const parseResult = schema.safeParse(body);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      const firstErrorMessage = Object.values(fieldErrors).flat()[0];
      throw new ApiError(400, (firstErrorMessage as string) || "Validation failed");
    }

    const { amount, note } = parseResult.data;
    const meta = {
      ip: req.headers.get("x-forwarded-for") || "",
      user: {
        id: session.user.id,
        role: session.user.role,
        company_id: session.user.company_id
      }
    };

    const result = await recordCompanyExpense({ amount, note }, meta);
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof ApiError ? error.message : "Something went wrong";
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    return NextResponse.json({ success: false, message: errorMessage }, { status: statusCode });
  }
}
