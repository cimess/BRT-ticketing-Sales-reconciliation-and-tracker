import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readReplicas } from "@prisma/extension-read-replicas";
import pg from "pg";

import sslConfig from "./database-ssl";

const { Pool } = pg;
const isProd = process.env.NODE_ENV === "production";

// 1. Resolve connection strings
let datasource = isProd
  ? (process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL??process.env.LOCAL_DATABASE_URL)
  : (process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL);

let replicaDatasource = isProd
  ? (process.env.READONLY_DATABASE_URL ?? datasource)
  : datasource;

// Prevent pg driver from throwing away our custom CA configuration by stripping sslmode query param
if (sslConfig) {
  if (datasource) datasource = datasource.replace(/[?&]sslmode=[^&]*/, "");
  if (replicaDatasource) replicaDatasource = replicaDatasource.replace(/[?&]sslmode=[^&]*/, "");
}

// 2. Initialize connection pools with low concurrency limits (max: 1) for serverless production
const primaryPool = new Pool({
  connectionString: datasource,
  ssl: sslConfig,
  max: isProd ? 3 : 10,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

const replicaPool = new Pool({
  connectionString: replicaDatasource,
  ssl: sslConfig,
  max: isProd ? 3 : 10,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

const primaryAdapter = new PrismaPg(primaryPool);
const replicaAdapter = new PrismaPg(replicaPool);

// 3. Instantiate primary and replica base clients
const baseClient = new PrismaClient({
  adapter: primaryAdapter,
});

const replicaClient = new PrismaClient({
  adapter: replicaAdapter,
});

// 4. Extend the base client to route reads to the replica
const prismaExtended = baseClient.$extends(
  readReplicas({
    replicas: [replicaClient],
  })
);

type ExtendedPrismaClient = typeof prismaExtended;

// 5. Setup global caching for local development HMR (no-any)
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaExtended;

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
