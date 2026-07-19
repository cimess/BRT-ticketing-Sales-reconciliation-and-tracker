// src/app/api/admin/query/r2/route.ts
import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";

// Types for DuckDB rows
type DuckDbQueryResult = Record<string, string | number | boolean | null>[];

export async function POST(req: NextRequest) {
  let db: DuckDBInstance | null = null;
  let connection: DuckDBConnection | null = null;

  try {
    const session = await auth();
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, company_id } = session.user;

    // Only Admins and Auditors can query R2 reports
    if (role !== "ADMIN" && role !== "AUDITOR") {
      return NextResponse.json({ error: "Forbidden: Auditor or Admin role required" }, { status: 403 });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query string is required" }, { status: 400 });
    }

    // 1. Strip SQL comments to prevent bypasses
    const sanitized = query
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();

    // 2. Enforce SELECT-only commands
    if (!/^\s*select\s/i.test(sanitized)) {
      return NextResponse.json({ error: "Only SELECT queries are permitted" }, { status: 400 });
    }

    // 3. Block destructive mutation statements
    const writeKeywords = /\b(insert|update|delete|drop|alter|truncate|replace|into|create|grant|revoke)\b/i;
    if (writeKeywords.test(sanitized)) {
      return NextResponse.json({
        error: "Forbidden: Mutation commands are strictly blocked."
      }, { status: 400 });
    }

    // 4. Multi-Tenant Check: ensure queries are filtered by this company ID
    if (!sanitized.toLowerCase().includes(company_id.toLowerCase())) {
      return NextResponse.json({
        error: `Tenant Boundary Violation: Your query must filter by your company_id: '${company_id}'.`
      }, { status: 400 });
    }

    // Initialize in-memory DuckDB instance and connection
    db = await DuckDBInstance.create(":memory:");
    connection = await db.connect();

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME || "";

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: "R2 credentials are misconfigured on server." }, { status: 500 });
    }

    // Configure DuckDB S3/R2 Endpoint configurations
    await connection.run("INSTALL httpfs;");
    await connection.run("LOAD httpfs;");
    await connection.run(`SET s3_endpoint = '${accountId}.r2.cloudflarestorage.com';`);
    await connection.run(`SET s3_access_key_id = '${accessKeyId}';`);
    await connection.run(`SET s3_secret_access_key = '${secretAccessKey}';`);
    await connection.run("SET s3_url_style = 'path';");

    // Resource limits to prevent CPU/RAM exhaustion
    await connection.run("SET max_memory = '512MB';"); // Caps query RAM allocation
    await connection.run("SET threads = 1;"); // Enforces single-core execution to avoid blocking Next.js event loop

    // Force limit 100 on execution to prevent server memory crashes
    const cleanSql = sanitized.replace(/;+$/, "");
    const queryWithLimit = `${cleanSql} LIMIT 100;`;

    // Dynamic path utility replacing custom keys in query with direct S3 URL
    // e.g. replacing 'reports_parquet' with 's3://bucket-name/reports/**/*.parquet'
    const finalSql = queryWithLimit
      .replace(/\breports_csv\b/gi, `read_csv('s3://${bucketName}/reports/**/*.csv', auto_detect=true)`)
      .replace(/\breports_parquet\b/gi, `read_parquet('s3://${bucketName}/reports/**/*.parquet')`);

    // Execute query using Promise API
    const resultReader = await connection.run(finalSql);
    const results = (await resultReader.getRowObjectsJS()) as DuckDbQueryResult;

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("DuckDB R2 Query Error:", err);
    return NextResponse.json({
      error: err.message || "Failed to execute DuckDB query."
    }, { status: 500 });
  } finally {
    // Safely close connection and instance to prevent memory leaks
    if (connection) {
      connection.closeSync();
    }
    if (db) {
      db.closeSync();
    }
  }
}
