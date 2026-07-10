// src/app/lib/prisma-readonly.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const isProd = process.env.NODE_ENV === "production";

// Use dedicated readonly URL or fallback to main URL (for local dev)
const connectionString = process.env.READONLY_DATABASE_URL || 
  ((isProd && process.env.DATABASE_URL) ? process.env.DATABASE_URL : (process.env.DATABASE_URL || process.env.LOCAL_DATABASE_URL));

// Auto-detect SSL based on connection string or environment
const sslConfig = connectionString?.includes("sslmode=disable")
  ? false
  : (connectionString?.includes("sslmode=require") || isProd)
    ? { rejectUnauthorized: false }
    : false;

const globalForReadonly = globalThis as unknown as {
  readonlyPrisma: PrismaClient | undefined;
  readonlyPool: pg.Pool | undefined;
};

const pool =
  globalForReadonly.readonlyPool ??
  new Pool({
    connectionString,
    ssl: sslConfig,
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
