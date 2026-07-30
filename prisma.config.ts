// prisma.config.ts

const config = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.NODE_ENV === "production"
      ? (process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL)
      : process.env.LOCAL_DATABASE_URL,
  },
};

export default config;
