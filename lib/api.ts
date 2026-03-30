/**
 * Centralized API client.
 * - Sends Authorization header with token from cookie (cross-origin backend doesn't receive cookies).
 * - Handles 401 globally (redirect to login after clearing panel cookie).
 * - Typed request/response.
 * - Uses env-based backend URL (dev vs production).
 */

const isDev = process.env.NODE_ENV === "development";
const apiBaseFromEnv =
  (isDev ? process.env.NEXT_PUBLIC_API_URL_DEV : process.env.NEXT_PUBLIC_API_URL) ??
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_URL_DEV ??
  "";

/**
 * Where the Flask API lives in the browser.
 * - Empty = same-origin `/api/*` (works when the page is served from nginx, e.g. :80).
 * - If you open Next directly on :3000 or :3001, `/api/*` would hit Next (HTML 404) — use gateway.
 */
/** 401 on these routes is “wrong password”, not “session expired”. */
function isPublicAuthRequestUrl(fullUrl: string): boolean {
  let path = fullUrl;
  try {
    path = new URL(fullUrl, "http://localhost").pathname;
  } catch {
    path = (fullUrl.split("?")[0] ?? "").replace(/^https?:\/\/[^/]+/, "");
  }
  return (
    path.includes("/api/auth/login") ||
    path.includes("/api/auth/register") ||
    path.includes("/api/auth/password/forgot") ||
    path.includes("/api/auth/password/reset")
  );
}

function getApiBase(): string {
  if (typeof window !== "undefined" && apiBaseFromEnv.startsWith("http://api:")) {
    return "";
  }
  if (apiBaseFromEnv) return apiBaseFromEnv.replace(/\/$/, "");
  if (typeof window === "undefined") return "";

  const port = window.location.port;
  const directNextPort = port === "3000" || port === "3001";
  if (!directNextPort) return "";

  const gw = (process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? "").trim().replace(/\/$/, "");
  if (gw) return gw;
  return `${window.location.protocol}//${window.location.hostname}:80`;
}

/** Reads auth token from panel cookie (readable for cross-origin API calls) */
function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/auth-token=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    return match[1].trim();
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Extract a user-friendly error message from a caught error (ApiError, Error, or unknown). */
export function getErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

function extractApiErrorMessage(body: unknown, statusText: string): string {
  if (typeof body === "object" && body !== null) {
    const o = body as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.error === "string" && o.error.trim()) return o.error;
  }
  if (typeof body === "string" && body.trim()) {
    const t = body.trim();
    if (t.startsWith("<!DOCTYPE") || t.toLowerCase().startsWith("<html")) {
      return "Server returned a web page instead of JSON — check the API URL.";
    }
    return t.length > 280 ? `${t.slice(0, 280)}…` : t;
  }
  return statusText || "Request failed";
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${getApiBase()}${url}`;

  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const network =
      msg === "Failed to fetch" ||
      msg === "Load failed" ||
      msg.includes("NetworkError when attempting to fetch");
    throw new ApiError(
      network
        ? "Cannot reach the server. Use nginx (same host as the app or your API domain) or check NEXT_PUBLIC_GATEWAY_ORIGIN."
        : `Network error: ${msg}`,
      0
    );
  }

  // Session expired: redirect — but NOT for login/register (401 = bad password).
  if (res.status === 401 && typeof window !== "undefined" && !isPublicAuthRequestUrl(fullUrl)) {
    await fetch("/api/auth/clear-cookie", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    window.location.href = "/login";
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  if (!res.ok) {
    const raw = await res.text();
    let body: unknown = raw;
    try {
      if (raw.trim()) body = JSON.parse(raw) as unknown;
    } catch {
      /* keep as string */
    }
    let message = extractApiErrorMessage(body, res.statusText);
    const rawStr = typeof body === "string" ? body : "";
    if (
      rawStr &&
      (rawStr.trimStart().startsWith("<!DOCTYPE") || rawStr.trimStart().startsWith("<html"))
    ) {
      message = `API returned HTML (${res.status}) instead of JSON — check NEXT_PUBLIC_API_URL / nginx routing.`;
    }
    throw new ApiError(message, res.status, body);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => apiRequest<T>(url, { method: "GET" }),
  post: <T>(url: string, data?: unknown) =>
    apiRequest<T>(url, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(url: string, data?: unknown) =>
    apiRequest<T>(url, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(url: string, data?: unknown) =>
    apiRequest<T>(url, { method: "PATCH", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(url: string) => apiRequest<T>(url, { method: "DELETE" }),
};
