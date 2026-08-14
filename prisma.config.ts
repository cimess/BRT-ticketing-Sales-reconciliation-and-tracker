// prisma.config.ts
import "dotenv/config";
const isProduction =
  process.env.NODE_ENV === "production" ||
  process.env.RENDER === "true" ||
  process.env.VERCEL === "true";

const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: isProduction
      ? (process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL)
      : process.env.LOCAL_DATABASE_URL,
  },
};

export default config;
