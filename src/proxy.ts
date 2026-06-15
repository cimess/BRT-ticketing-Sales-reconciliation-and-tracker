// src/middleware.ts
import { getToken } from "next-auth/jwt";
import { NextResponse, NextRequest } from "next/server";

// 1. Strict Matrix Permissions (Hierarchy Access Control)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["/dashboard/admin", "/dashboard/supervisor", "/dashboard/ticketer"],
  SUPERVISOR: ["/dashboard/supervisor", "/dashboard/ticketer"],
  TICKETER: ["/dashboard/ticketer"],
};

export async function proxy(req: NextRequest) {
  const token = await getToken({ 
    req , 
    secret: process.env.AUTH_SECRET
  });
  const path = req.nextUrl.pathname;

  // 2. PUBLIC/STATIC ALLOWLIST (Bypass checks for core Next.js processes)
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api/auth") || // Essential for NextAuth login/logout requests
    path === "/favicon.ico" ||
    path === "/unauthorized"
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // 3. SIGNUP PAGE ACCESSIBILITY
  if (path === "/signup") {
    // If a logged-in user accidentally goes to /signup, redirect them to dashboard
    if (token) return redirectToDashboard(token.role as string, req);
    return addSecurityHeaders(NextResponse.next());
  }

  // 4. ROOT ROUTE DIRECTORY (The Login Page)
  if (path === "/") {
    // If user is already authenticated, don't show the login page; push them inside
    if (token) return redirectToDashboard(token.role as string, req);
    return addSecurityHeaders(NextResponse.next());
  }

  // 5. AUTOMATED EXPULSION / EXPIRED TOKEN GUARD
  // If hitting any protected dashboard route without a valid token, expel immediately to root (/)
  if (!token) {
    const sessionExpiredResponse = NextResponse.redirect(new URL("/", req.url));
    
    // Clear cookies explicitly on expulsion to prevent stale/corrupted local sessions
    sessionExpiredResponse.cookies.delete("next-auth.session-token");
    sessionExpiredResponse.cookies.delete("__Secure-next-auth.session-token");
    
    return addSecurityHeaders(sessionExpiredResponse);
  }

  // 6. ROLE-BASED SEGREGATION GUARD
  if (path.startsWith("/dashboard/")) {
    const userRole = (token.role as string) || "";
    const allowedPaths = ROLE_PERMISSIONS[userRole] || [];
    
    // Validate if user has permission for the exact folder path
    const hasPermission = allowedPaths.some((allowedPath) => path.startsWith(allowedPath));

    if (!hasPermission) {
      return addSecurityHeaders(NextResponse.redirect(new URL("/unauthorized", req.url)));
    }
  }

  return addSecurityHeaders(NextResponse.next());
}

// 7. DASHBOARD ROUTER HELPER
function redirectToDashboard(role: string, req: NextRequest) {
  if (role === "ADMIN") return NextResponse.redirect(new URL("/dashboard/admin", req.url));
  if (role === "SUPERVISOR") return NextResponse.redirect(new URL("/dashboard/supervisor", req.url));
  if (role === "TICKETER") return NextResponse.redirect(new URL("/dashboard/ticketer", req.url));
  return NextResponse.redirect(new URL("/unauthorized", req.url));
}

// 8. OWASP-ALIGNED ADVANCED SECURITY HEADERS
function addSecurityHeaders(response: NextResponse) {
  const headers = response.headers;
  
  // Prevents your system from being rendered inside an iframe (Clickjacking defense)
  headers.set("X-Frame-Options", "DENY");
  
  // Prevents browsers from guessing/sniffing content types away from declared headers
  headers.set("X-Content-Type-Options", "nosniff");
  
  // Restricts how much referral data is passed when navigating outward
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Force HTTPS exclusively (Strict-Transport-Security) for 1 year
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  
  // Basic XSS Protection policy
  headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

// 9. HIGH-PERFORMANCE MATCHER CONFIGURATION
// Runs middleware ONLY on the entry page, signup page, and deep dashboard segments
export const config = {
  matcher: ["/", "/signup", "/dashboard/:path*"],
};
