import { NextRequest, NextResponse } from "next/server";
import type { NextMiddleware } from "next/server";

// Routes that don't require authentication
const publicRoutes = ["/", "/login", "/signup"];

export const middleware: NextMiddleware = async (request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // For authenticated routes, we check for session via client-side
  // The useAuth hook will redirect to login if not authenticated
  return NextResponse.next();
};

export const config = {
  matcher: ["/((?!_next|.*\\..*|api).*)"],
};

