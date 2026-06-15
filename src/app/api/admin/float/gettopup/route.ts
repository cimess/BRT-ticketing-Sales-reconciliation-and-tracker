// src/app/api/admin/float/gettopup/route.ts

import { auth } from "@/auth";
import { getTopUps } from "@/app/server/services/topup.service";
import { NextRequest } from "next/server"; // Import NextRequest

export async function GET(req: NextRequest) {
    try {
        const session = await auth()
        
        if (!session?.user) {
            return Response.json({error: "Unauthorized"}, {status: 401});
        }

        const { searchParams } = new URL(req.url);
        const fromDate = searchParams.get("fromDate") || undefined;
        const toDate = searchParams.get("toDate") || undefined;

        const topUps = await getTopUps({
            fromDate,
            toDate,
        });
        
        return Response.json({topUps});
    } catch(e) {
        return Response.json({error: e instanceof Error ? e.message : e}, {status: 500});
    }
}
