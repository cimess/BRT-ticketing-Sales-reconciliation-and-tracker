// src/proxy.ts (Next.js 16 Standard)
import { getToken } from "next-auth/jwt";
import { NextResponse, NextRequest } from "next/server";

// 1. Strict Matrix Permissions (Hierarchy Access Control for both Pages and APIs)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "/dashboard/admin",
    "/dashboard/supervisor",
    "/dashboard/ticketer",
    "/api/admin",
    "/api/supervisor",
    "/api/ticketer",
    "/api/dashboard",
    "/api/remitance",
    "/api/transaction",
    "/api/locations",
    "/api/reconcile",
    "/api/sales",
    "/api/commision",
    "/api/admin/commision-earnings",
    "/api/admin/commision-rules",
    "/api/fines",
    "/api/events",
    "/api/notifications",
    "/api/reports"
  ],
  AUDITOR: [
    "/dashboard/admin",
    "/dashboard/supervisor",
    "/dashboard/ticketer",
    "/api/admin",
    "/api/supervisor",
    "/api/ticketer",
    "/api/dashboard",
    "/api/remitance",
    "/api/transaction",
    "/api/locations",
    "/api/sales",
    "/api/reconcile",
    "/api/admin/commision-earnings",
    "/api/events",
    "/api/notifications",
    "/api/reports"
  ],
  SUPERVISOR: [
    "/dashboard/supervisor",
    "/dashboard/ticketer",
    "/api/supervisor",
    "/api/ticketer",
    "/api/dashboard/metrics",
    "/api/admin/user",
    "/api/remitance",
    "/api/transaction",
    "/api/locations",
    "/api/sales",
    "/api/reconcile",
    "/api/admin/commision-earnings",
    "/api/fines",
    "/api/events",
    "/api/notifications",
    "/api/reports"
  ],
  TICKETER: [
    "/dashboard/ticketer",
    "/api/ticketer",
    "/api/dashboard/metrics",
    "/api/admin/user",
    "/api/remitance",
    "/api/transaction",
    "/api/locations",
    "/api/sales",
    "/api/reconcile",
    "/api/admin/commision-earnings",
    "/api/fines",
    "/api/events",
    "/api/notifications"

  ],
};


export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET
  });
  const path = req.nextUrl.pathname;

  // 2. PUBLIC/STATIC ALLOWLIST (Bypass checks for core Next.js processes & Auth endpoints)
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api/auth") || // Essential for NextAuth login/logout requests
    path.startsWith("/api/register") ||
    path.startsWith("/api/verifyToken") ||
    path.startsWith("/api/regtoken") ||
    path === "/favicon.ico" ||
    path === "/unauthorized"
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // 3. SIGNUP PAGE ACCESSIBILITY
  if (path === "/signup") {
    if (token) return redirectToDashboard(token.role as string, req);
    return addSecurityHeaders(NextResponse.next());
  }

  // 4. ROOT ROUTE DIRECTORY (The Login Page)
  if (path === "/") {
    if (token) return redirectToDashboard(token.role as string, req);
    return addSecurityHeaders(NextResponse.next());
  }

  // 5. AUTOMATED EXPULSION / EXPIRED TOKEN GUARD
  if (!token) {
    // If it's an API request, return a 401 JSON error instead of redirecting to login page
    if (path.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const sessionExpiredResponse = NextResponse.redirect(new URL("/", req.url));
    sessionExpiredResponse.cookies.delete("next-auth.session-token");
    sessionExpiredResponse.cookies.delete({
      name: "__Secure-next-auth.session-token",
      secure: true,
      path: "/",
    });
    sessionExpiredResponse.cookies.delete("authjs.session-token");
    return addSecurityHeaders(sessionExpiredResponse);
  }

  // 6. ROLE-BASED SEGREGATION GUARD FOR DASHBOARD PAGES & API ROUTES
  if (path.startsWith("/dashboard/") || path.startsWith("/api/")) {
    const userRole = (token.role as string) || "";
    const allowedPaths = ROLE_PERMISSIONS[userRole] || [];
    const hasPermission = allowedPaths.some((allowedPath) => path.startsWith(allowedPath));

    if (!hasPermission) {
      // If it's an API request, return a clean 403 Forbidden instead of redirecting
      if (path.startsWith("/api/")) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: "Forbidden: You do not have permission to access this resource" },
            { status: 403 }
          )
        );
      }
      return addSecurityHeaders(NextResponse.redirect(new URL("/unauthorized", req.url)));
    }
  }

  return addSecurityHeaders(NextResponse.next());
}

// 7. DASHBOARD ROUTER HELPER
function redirectToDashboard(role: string, req: NextRequest) {
  if (role === "ADMIN" || role === "AUDITOR") return NextResponse.redirect(new URL("/dashboard/admin", req.url)); // 💡 Added Auditor
  if (role === "SUPERVISOR") return NextResponse.redirect(new URL("/dashboard/supervisor", req.url));
  if (role === "TICKETER") return NextResponse.redirect(new URL("/dashboard/ticketer", req.url));
  return NextResponse.redirect(new URL("/unauthorized", req.url));
}

// 8. OWASP-ALIGNED ADVANCED SECURITY HEADERS
function addSecurityHeaders(response: NextResponse) {
  const headers = response.headers;
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  headers.set("X-XSS-Protection", "1; mode=block");
  return response;
}

// 9. HIGH-PERFORMANCE MATCHER CONFIGURATION
export const config = {
  matcher: ["/", "/signup", "/dashboard/:path*", "/api/:path*"],
};
