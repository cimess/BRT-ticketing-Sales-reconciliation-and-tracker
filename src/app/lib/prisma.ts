// src/app/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import path from "path";
import fs from "fs";

const { Pool } = pg;

const isProd = process.env.NODE_ENV === "production";

// Fallback to local database url if DATABASE_URL is empty
let datasource = (isProd && process.env.DATABASE_URL)
  ? process.env.DATABASE_URL
  : (process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL);

// Clean connection string to avoid conflicts with pg parser
if (datasource && datasource.includes("sslmode=")) {
  datasource = datasource.split("?")[0] || "";
}

// Secure SSL configuration: Verify identity using CA certificate
let sslConfig: { rejectUnauthorized: boolean; ca?: string } | boolean = false;

if (isProd) {
  const prodConfig: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized: true,
  };

  // 1. Check for CA certificate in environment variable
  if (process.env.DATABASE_CA_CERT) {
    console.log("[Database] Using CA Certificate from: Environment Variable (DATABASE_CA_CERT)");
    prodConfig.ca = process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n");
  } else {
    // 2. Fallback: check for ca.pem file in project directories
    const pathsToCheck = [
      path.resolve(process.cwd(), "ca.pem"),
      path.resolve(process.cwd(), "certs/ca.pem"),
    ];

    const caPath = pathsToCheck.find(p => fs.existsSync(p));
    if (caPath) {
      console.log(`[Database] Using CA Certificate from file: ${caPath}`);
      prodConfig.ca = fs.readFileSync(caPath).toString();
    } else {
      console.error("[Database] WARNING: CA Certificate NOT found. TLS connection might fail.");
    }
  }
  sslConfig = prodConfig;
} else {
  sslConfig = { rejectUnauthorized: false };
}


// Extend the global object to cache both the prisma client and the pg pool
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

// Create or reuse the database pool
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: datasource,
    ssl: sslConfig,
    max: isProd ? 15 : 10, // Leave slots open for migrations & dashboards
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
  });

if (!isProd) {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

// Create or reuse the Prisma client
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}

// Prevent running rules initialization queries during Next.js static build phase
if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
  import("@/app/server/services/rules.service").then(({ ensureDefaultRules }) => {
    ensureDefaultRules().catch((err) =>
      console.error("[Startup] Failed to initialize default company rules:", err)
    );
  });
}
