/**
 * Auth helpers.
 * JWT is stored in httpOnly cookie by backend — no localStorage.
 * When panel and API are on different domains, we also set a panel-domain cookie via /api/auth/set-cookie.
 */

import { api } from "./api";
import type { LoginPayload, LoginResponse } from "@/types";

const AUTH_LOGIN_PATH = "/api/auth/login";
const AUTH_LOGOUT_PATH = "/api/auth/logout";
const AUTH_ME_PATH = "/api/auth/profile";

/** Backend login response shape (data.access_token) */
interface LoginApiResponse {
  success?: boolean;
  data?: { access_token?: string };
}

export async function login(payload: LoginPayload): Promise<LoginResponse & LoginApiResponse> {
  const res = await api.post<LoginResponse & LoginApiResponse>(AUTH_LOGIN_PATH, payload);
  return res;
}

/** Sets panel-domain cookie so middleware sees auth (required when panel and API are cross-origin) */
export async function setPanelAuthCookie(accessToken: string): Promise<void> {
  await fetch("/api/auth/set-cookie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
    credentials: "include",
  });
}

/** Clears panel-domain auth cookie on logout */
export async function clearPanelAuthCookie(): Promise<void> {
  await fetch("/api/auth/clear-cookie", {
    method: "POST",
    credentials: "include",
  });
}

export async function logout(): Promise<void> {
  await api.post(AUTH_LOGOUT_PATH);
}

export async function getSession(): Promise<{ email?: string; name?: string } | null> {
  try {
    const res = await api.get<{ data?: { user?: { email: string; name?: string } } }>(AUTH_ME_PATH);
    return res?.data?.user ?? null;
  } catch {
    return null;
  }
}
