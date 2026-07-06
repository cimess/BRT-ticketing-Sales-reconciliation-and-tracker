// src/app/lib/prisma.ts
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const isProd = process.env.NODE_ENV === "production";

const datasource = isProd
  ? process.env.DATABASE_URL
  : process.env.LOCAL_DATABASE_URL;

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
    ssl: isProd ? { rejectUnauthorized: false } : false,
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


if (typeof window === "undefined") {
  import("@/app/server/services/rules.service").then(({ ensureDefaultRules }) => {
    ensureDefaultRules().catch((err) =>
      console.error("[Startup] Failed to initialize default company rules:", err)
    );
  });
}
