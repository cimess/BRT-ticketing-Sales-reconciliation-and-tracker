// src/app/api/admin/query/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { readonlyPrisma } from "@/app/lib/prisma-readonly";

// Tables holding company-specific data
const TENANT_TABLES = [
  "user", "sales_record", "remittance", "fine", "pos_device", 
  "float_ledger", "company", "remittanceexpectation", "companyfloat",
  "auditlog", "commisionrule", "commisionearning"
];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, company_id } = session.user;

    // Only Admins and Auditors are allowed to run custom queries
    if (role !== "ADMIN" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Forbidden: Auditor or Admin role required" }, { status: 403 });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query string is required" }, { status: 400 });
    }

    // 1. Strip SQL comment tags to prevent query obfuscation bypasses
    const sanitized = query
      .replace(/--.*$/gm, "") // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
      .trim();

    // 2. Enforce SELECT-only start word
    const isSelect = /^\s*select\s/i.test(sanitized);
    if (!isSelect) {
      return NextResponse.json({ error: "Only SELECT queries are permitted" }, { status: 400 });
    }

    // 3. Block writing/mutating SQL keywords
    const writeKeywords = /\b(insert|update|delete|drop|alter|truncate|replace|into|create|grant|revoke)\b/i;
    if (writeKeywords.test(sanitized)) {
      return NextResponse.json({ 
        error: "Forbidden: Mutation commands (INSERT, UPDATE, DELETE, etc.) are strictly blocked." 
      }, { status: 400 });
    }

    // 4. Enforce Company ID Tenant boundary
    const queryLower = sanitized.toLowerCase();
    const touchesTenantTable = TENANT_TABLES.some(table => queryLower.includes(table));
    if (touchesTenantTable) {
      const companyIdPresent = queryLower.includes(company_id.toLowerCase());
      if (!companyIdPresent) {
        return NextResponse.json({ 
          error: `Multi-tenant violation: Your query touches company tables. You must include your company_id: '${company_id}' in the filters.` 
        }, { status: 400 });
      }
    }

    // 5. Force a row limit of 100 to prevent memory blowouts
    const cleanSql = sanitized.replace(/;+$/, "");
    const queryWithLimit = `${cleanSql} LIMIT 100;`;

    // 6. Run query on read-only database instance
    const results = await readonlyPrisma.$queryRawUnsafe(queryWithLimit);

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("SQL query error:", error);

    return NextResponse.json({ 
      error: "Failed to execute query. Check database logs or SQL syntax." 
    }, { status: 500 });
  }
}
