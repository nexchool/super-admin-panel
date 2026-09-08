/**
 * Renew the operator's access token from the refresh token, on the server.
 *
 * Here rather than in the browser because the refresh token is httpOnly:
 * nothing in the panel's JavaScript can read it, which is the point. This
 * route reads the cookie, spends it against the API, and writes the new pair
 * back.
 *
 * Refresh tokens rotate — one may be spent once — so the replacement the API
 * returns *must* be stored. Dropping it would leave the next renewal
 * presenting a token that has already been used, which the API is entitled to
 * read as a stolen token being replayed.
 */

import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE_SECONDS = 20 * 60;
/**
 * The panel's own session ceiling — twelve hours, not the thirty days this
 * used to be.
 *
 * An operator here can enter any school on the system, so the API gives the
 * `panel` surface its own session lifetime: thirty minutes idle, twelve hours
 * absolute (`server/modules/auth/session_policy.py`). A cookie outliving that
 * would not extend anything — the API is the authority and refuses on its own
 * clock — it would just leave a browser holding a credential that stopped
 * working hours ago, and an operator staring at a signed-in shell where
 * nothing loads. The cookie is kept honest about the session behind it.
 */
const REFRESH_COOKIE_SECONDS = 12 * 60 * 60;

function apiBase(): string {
  const isDev = process.env.NODE_ENV === "development";
  const configured =
    (isDev ? process.env.NEXT_PUBLIC_API_URL_DEV : process.env.NEXT_PUBLIC_API_URL) ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_URL_DEV ??
    "";
  return configured.replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh-token")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBase()}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Surface": "panel",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
  } catch {
    // The API being unreachable is not the session being over.
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  if (!upstream.ok) {
    // Refused: the session really is finished. Clear both cookies so the
    // panel stops believing otherwise.
    const failure = NextResponse.json({ error: "Session expired" }, { status: 401 });
    for (const name of ["auth-token", "refresh-token"]) {
      failure.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    return failure;
  }

  const payload = (await upstream.json()) as {
    data?: { access_token?: string; refresh_token?: string };
  };
  const next = payload?.data;
  if (!next?.access_token || !next?.refresh_token) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const isProd = process.env.NODE_ENV === "production";
  const response = NextResponse.json({ success: true });
  response.cookies.set("auth-token", next.access_token, {
    path: "/",
    httpOnly: false,
    secure: isProd,
    sameSite: "lax",
    maxAge: ACCESS_COOKIE_SECONDS,
  });
  response.cookies.set("refresh-token", next.refresh_token, {
    path: "/",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: REFRESH_COOKIE_SECONDS,
  });
  return response;
}
