import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import sslConfig from "./database-ssl";

const { Pool } = pg;

const isProd = process.env.NODE_ENV === "production";

const datasource =
  process.env.NODE_ENV === "production"
    ? (process.env.DATABASE_URL ?? process.env.LOCAL_DATABASE_URL)
    : (process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: datasource,
    ssl: sslConfig,
    max: isProd ? 3 : 10,
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
  });

if (!isProd) {
  globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}

// Don't execute during build
if (
  typeof window === "undefined" &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  import("@/app/server/services/rules.service").then(
    ({ ensureDefaultRules }) => {
      ensureDefaultRules().catch((error) => {
        console.error(
          "[Startup] Failed to initialize default company rules:",
          error
        );
      });
    }
  );
}