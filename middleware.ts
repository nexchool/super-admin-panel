import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOGIN_PATH = "/login";
const DASHBOARD_PREFIX = "/dashboard";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;
  const isDashboard = pathname.startsWith(DASHBOARD_PREFIX);

  const hasAuthCookie =
    request.cookies.has("token") ||
    request.cookies.has("session") ||
    request.cookies.has("auth-token");

  if (isDashboard && !hasAuthCookie) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && hasAuthCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

// Matchers must be string literals (Next.js parses `config` at compile time).
export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};
