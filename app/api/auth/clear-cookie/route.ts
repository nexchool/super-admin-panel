/**
 * Clears the panel-domain session cookies on logout.
 *
 * Both of them. Leaving the refresh token behind would let the next page load
 * renew its way back into a session the operator has just ended.
 */

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  for (const name of ["auth-token", "refresh-token"]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
