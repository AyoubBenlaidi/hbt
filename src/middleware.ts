import { NextRequest, NextResponse } from "next/server";
import type { NextMiddleware } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

// Better Auth session cookie (prefixed with __Secure- on HTTPS)
const sessionCookies = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/**
 * Sends visitors without a session cookie to the login page.
 * Only checks that the cookie exists (no database call): pages and server
 * actions still validate the session itself.
 */
export const middleware: NextMiddleware = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  const hasSession = sessionCookies.some((name) => request.cookies.has(name));
  if (publicRoutes.includes(pathname) || hasSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
};

export const config = {
  matcher: ["/((?!_next|.*\\..*|api).*)"],
};
