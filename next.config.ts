import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  
  // 1. Fixes: "Information Disclosure via X-Powered-By HTTP response headers"
  // Completely disables the X-Powered-By: Next.js header
  poweredByHeader: false, 

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
  },

  // 2. Fixes: "Missing Content Security Policy (CSP)", "Anti-MIME-Sniffing (X-Content-Type-Options)", and other HTTP security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.r2.cloudflarestorage.com; connect-src 'self' ws: wss: https://*.r2.cloudflarestorage.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://cimessinvest.com; font-src 'self' data:; frame-ancestors 'none';"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
