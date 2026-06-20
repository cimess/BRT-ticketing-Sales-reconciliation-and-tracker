import { NextResponse } from "next/server";
import { reverseTopUp } from "@/server/services/topup.service";
import { reverseTopUpSchema } from "@/schemas/auth.schema";
import { ApiError } from "@/lib/ApiError";
import { auth } from "@/auth";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const session = await auth();
        if (!session?.user || !session.user.id || !["ADMIN", "AUDITOR"].includes(session.user.role)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const meta = {
            ip: req.headers.get("x-forwarded-for") || "",
            userid:session.user.id,
            company_id:session.user.company_id
        };
        const validate = reverseTopUpSchema.safeParse(body);
        if (!validate.success) {
            return NextResponse.json({ error: validate.error.message }, { status: 400 });
        }
        const result = await reverseTopUp(body, meta);
        if (!result?.success) {
            return NextResponse.json(
                { error: result?.message },
                { status: result?.status }
            );
        }
        return NextResponse.json(result);
    } catch (error: unknown) {

        let errorMessage = error instanceof ApiError ? error?.message : "Something went wrong";
        const statusCode = error instanceof ApiError ? error?.statusCode : 500;
        if (statusCode === 500) {

            console.log(error, "this is the error message")
            errorMessage = "Something went wrong";
        }
        return Response.json({ success: false, message: errorMessage }, { status: statusCode });
    }
}