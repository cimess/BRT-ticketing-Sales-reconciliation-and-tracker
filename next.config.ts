import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  /* config options here */
  allowedDevOrigins: ['192.168.0.197:3000', '192.168.0.197', process.env.NEXTAUTH_URL || "https://cimessinvest.com"],

  serverExternalPackages: ["@duckdb/node-api"],
  experimental: {
    // Limits the entry files processed immediately upon boot
    preloadEntriesOnStart: false,
    // Forces Next.js to spin up temporary compilation threads that drop memory once done
    webpackBuildWorker: true
  }
};

export default nextConfig;
