// src/app/lib/prisma-readonly.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import path from "path";
import fs from "fs";

const { Pool } = pg;

const isProd = process.env.NODE_ENV === "production";

// Use dedicated readonly URL or fallback to main URL (for local dev)
let connectionString = process.env.READONLY_DATABASE_URL || 
  ((isProd && process.env.DATABASE_URL) ? process.env.DATABASE_URL : (process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL));

// Clean connection string to avoid conflicts with pg parser
if (connectionString && connectionString.includes("sslmode=")) {
  connectionString = connectionString.split("?")[0] || "";
}

// Secure SSL configuration: Verify identity using CA certificate
let sslConfig: { rejectUnauthorized: boolean; ca?: string } | boolean = false;

if (isProd) {
  const prodConfig: { rejectUnauthorized: boolean; ca?: string } = {
    rejectUnauthorized: true,
  };

  // 1. Check for CA certificate in environment variable
  if (process.env.DATABASE_CA_CERT) {
    prodConfig.ca = process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n");
  } else {
    // 2. Fallback: check for ca.pem file in project directories
    const pathsToCheck = [
      path.resolve(process.cwd(), "ca.pem"),
      path.resolve(process.cwd(), "certs/ca.pem"),
    ];

    const caPath = pathsToCheck.find(p => fs.existsSync(p));
    if (caPath) {
      prodConfig.ca = fs.readFileSync(caPath).toString();
    }
  }
  sslConfig = prodConfig;
} else {
  sslConfig = { rejectUnauthorized: false };
}



const globalForReadonly = globalThis as unknown as {
  readonlyPrisma: PrismaClient | undefined;
  readonlyPool: pg.Pool | undefined;
};

const pool =
  globalForReadonly.readonlyPool ??
  new Pool({
    connectionString,
    ssl: sslConfig,
    max: isProd ? 2 : 10,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    statement_timeout: 2000, // Safety: Automatically kill any query taking > 2 seconds!
  });

if (!isProd) {
  globalForReadonly.readonlyPool = pool;
}

const adapter = new PrismaPg(pool);

export const readonlyPrisma =
  globalForReadonly.readonlyPrisma ??
  new PrismaClient({ adapter });

if (!isProd) {
  globalForReadonly.readonlyPrisma = readonlyPrisma;
}
