import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE_PATH = "/panel";
const BASE_PATH_SLASH = "/panel/";
const DASHBOARD_PREFIX = `${BASE_PATH}/dashboard`;
const LOGIN_PATH = `${BASE_PATH}/login`;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;
  const isDashboard = pathname.startsWith(DASHBOARD_PREFIX);

  const hasAuthCookie =
    request.cookies.has("token") ||
    request.cookies.has("session") ||
    request.cookies.has("auth-token");

  // If user lands on the base panel path, redirect to dashboard.
  if (pathname === BASE_PATH || pathname === BASE_PATH_SLASH) {
    return NextResponse.redirect(new URL(`${BASE_PATH}/dashboard`, request.url));
  }

  if (isDashboard && !hasAuthCookie) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && hasAuthCookie) {
    return NextResponse.redirect(new URL(`${BASE_PATH}/dashboard`, request.url));
  }

  return NextResponse.next();
}

// Matchers must be string literals (Next.js parses `config` at compile time).
export const config = {
  matcher: [
    "/panel",
    "/panel/",
    "/panel/dashboard/:path*",
    "/panel/login",
  ],
};
