// Replace src/app/api/admin/rules/route.ts with:

import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureCompanyRules, DEFAULT_RULES } from "@/app/server/services/rules.service";
import { cacheGet, cacheSet } from "@/app/lib/redis";


export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const companyId = session.user.company_id;

       const cacheKey = `cache:rules:${companyId}`;
    // 1. Try cache first
    const cachedRules = await cacheGet(cacheKey);
    if (cachedRules) {
      return NextResponse.json(cachedRules);
    }

    // 1. Fetch the rules
    let rules = await prisma.companyRule.findMany({
      where: { company_id: companyId },
      orderBy: { created_at: "desc" },
    });

    // 2. Quick memory check: If count is less than default rules, run self-healing
    if (rules.length < DEFAULT_RULES.length) {
      await ensureCompanyRules(companyId);
      
      // Re-fetch the newly populated rules
      rules = await prisma.companyRule.findMany({
        where: { company_id: companyId },
        orderBy: { created_at: "desc" },
      });
    }

    const responsePayload = { success: true, data: rules };
    // 3. Cache rules for 5 minutes (300s)
    await cacheSet(cacheKey, responsePayload, 300);
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Failed to list rules:", error);
    return NextResponse.json({ error: "Failed to list rules" }, { status: 500 });
  }
}

