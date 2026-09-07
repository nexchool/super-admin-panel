/**
 * Stores the operator's tokens as panel-domain cookies.
 *
 * The panel and the API are on different domains, so the API's own
 * `Set-Cookie` is never stored by the browser; the panel keeps its own pair.
 *
 * The two cookies are deliberately different in kind:
 *
 *   `auth-token`     the access token, readable by JavaScript because
 *                    `lib/api.ts` has to put it in an Authorization header
 *                    for a cross-origin call. It is short-lived, so what a
 *                    script could steal expires in minutes.
 *
 *   `refresh-token`  httpOnly. Nothing in the browser needs to read it —
 *                    renewal happens in `/api/auth/renew`, on the server —
 *                    and it is the long-lived credential, so the one that
 *                    must not be reachable from a script.
 */

import { NextRequest, NextResponse } from "next/server";

/** Matches the API's own default access-token lifetime, with a little slack
 *  for clock drift. The cookie outliving the token by hours would only mean
 *  the panel believing it is signed in while every request is refused. */
const ACCESS_COOKIE_SECONDS = 20 * 60;
/** The refresh token's own lifetime, which is what actually bounds a session. */
const REFRESH_COOKIE_SECONDS = 30 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body?.access_token;
    const refreshToken = body?.refresh_token;
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Missing access_token" },
        { status: 400 }
      );
    }

    const isProd = process.env.NODE_ENV === "production";
    const response = NextResponse.json({ success: true });
    response.cookies.set("auth-token", token, {
      path: "/",
      httpOnly: false, // read by api.ts for the cross-origin Authorization header
      secure: isProd,
      sameSite: "lax",
      maxAge: ACCESS_COOKIE_SECONDS,
    });
    if (typeof refreshToken === "string" && refreshToken) {
      response.cookies.set("refresh-token", refreshToken, {
        path: "/",
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        maxAge: REFRESH_COOKIE_SECONDS,
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
