/**
 * Renewing the operator's access token, exactly once — across every tab.
 *
 * The panel opens several requests at a time — a list, its counts, the
 * operator's profile — and when the access token expires they all come back
 * 401 together. Each one asking for a renewal would spend the same refresh
 * token several times over, and because refresh tokens rotate the API cannot
 * tell that from a stolen token being replayed: it would end the session,
 * which the operator would experience as being signed out for opening a busy
 * page.
 *
 * The shared promise below stops that inside one tab. It does nothing between
 * tabs — the promise is per-JavaScript-context while the cookie belongs to the
 * origin — so renewal also serializes on a Web Lock. An operator with the
 * tenant list open beside a school's detail page is the ordinary case, not an
 * attack, and it must not cost them their session.
 *
 * The work itself happens in `/api/auth/renew`, a route handler on the panel's
 * own origin, because the refresh token is httpOnly and this file cannot read
 * it. That is also why the "did another tab already renew?" question is
 * answered by the marker below rather than by comparing tokens the way
 * `admin-web` can: nothing here is allowed to see them.
 */

let inFlight: Promise<boolean> | null = null;

const RENEWAL_LOCK = "nexchool-panel-session-renewal";

/**
 * When a renewal last succeeded on this origin, in epoch milliseconds.
 *
 * Not a secret and not a credential — a timestamp. It exists because the thing
 * that would answer this question directly, the token, is deliberately out of
 * this file's reach.
 */
const LAST_RENEWAL_KEY = "panel:last-renewal";

function lastRenewal(): number {
  try {
    return Number(window.localStorage.getItem(LAST_RENEWAL_KEY)) || 0;
  } catch {
    // Storage disabled or partitioned. Losing the optimisation is fine; the
    // renewal below still happens, and the API's grace window covers the rest.
    return 0;
  }
}

function noteRenewal(): void {
  try {
    window.localStorage.setItem(LAST_RENEWAL_KEY, String(Date.now()));
  } catch {
    /* ignore — see lastRenewal */
  }
}

async function performRenewal(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/renew", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    if (response.ok) noteRenewal();
    return response.ok;
  } catch {
    // A network failure is not an expired session; the next request retries.
    return false;
  }
}

/**
 * Renew, unless the wait for the lock was itself the renewal.
 *
 * `startedAt` is when this tab decided it needed a new token. A renewal
 * recorded after that moment was somebody else's, and it has already replaced
 * the cookie this tab is about to use — so there is nothing left to do but say
 * so. Spending another token here would be a pointless extra generation.
 */
async function renewUnlessAnotherTabDid(startedAt: number): Promise<boolean> {
  if (lastRenewal() > startedAt) return true;
  return performRenewal();
}

function underOriginLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  // No Web Locks (older Safari, a non-secure context) means the old
  // behaviour, which the API's rotation grace window tolerates.
  if (!locks) return work();
  // `LockManager.request` is typed as resolving whatever the callback returns,
  // which for an async callback nests one Promise inside another. The runtime
  // value is the settled result; the cast says so rather than restructuring a
  // three-line function around a typings quirk.
  return locks.request(RENEWAL_LOCK, work) as Promise<T>;
}

/** Renew the access token, joining a renewal already under way. */
export function refreshSession(): Promise<boolean> {
  if (!inFlight) {
    const startedAt = Date.now();
    inFlight = underOriginLock(() => renewUnlessAnotherTabDid(startedAt)).finally(
      () => {
        inFlight = null;
      }
    );
  }
  return inFlight;
}
