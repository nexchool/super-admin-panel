/**
 * Renewing the operator's access token, exactly once no matter who asked.
 *
 * The panel opens several requests at a time — a list, its counts, the
 * operator's profile — and when the access token expires they all come back
 * 401 together. Each one asking for a renewal would spend the same refresh
 * token several times over, and because refresh tokens rotate the API cannot
 * tell that from a stolen token being replayed: it would end the session,
 * which the operator would experience as being signed out for opening a busy
 * page. So the promise is shared and every caller waits on the same renewal.
 *
 * The work itself happens in `/api/auth/renew`, a route handler on the
 * panel's own origin, because the refresh token is httpOnly and this file
 * cannot read it.
 */

let inFlight: Promise<boolean> | null = null;

async function performRenewal(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/renew", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    // A network failure is not an expired session; the next request retries.
    return false;
  }
}

/** Renew the access token, joining a renewal already under way. */
export function refreshSession(): Promise<boolean> {
  if (!inFlight) {
    inFlight = performRenewal().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
