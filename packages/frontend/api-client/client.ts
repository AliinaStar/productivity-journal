import { BASE_URL } from './config';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './auth-store';

/** Thrown when the session can no longer be authenticated and the user must sign in again. */
export class AuthError extends Error {
  constructor(message = 'Session expired.') {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * A request the server rejected, carrying the status code.
 *
 * Sync needs to tell "try again later" apart from "this will never work":
 * a 403 on an entry whose week has closed can only be resolved by dropping
 * the local change, whereas a 500 or a dropped connection should be retried.
 * Without the status the caller sees an indistinguishable Error and would
 * retry the hopeless case forever.
 */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Revoke the refresh token server-side, then clear local tokens. Best-effort. */
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Network failure on logout is non-fatal — local tokens are cleared anyway.
    }
  }
  await clearTokens();
}

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;

  const data = await res.json();
  await setAccessToken(data.access_token);
  // The server rotates the refresh token on every exchange; persist the new one
  // so the next refresh doesn't replay the now-revoked token.
  if (data.refresh_token) await setRefreshToken(data.refresh_token);
  return data.access_token;
}

// Single-flight: concurrent 401s share one refresh call. Without this, the
// second request would replay a refresh token the first has already rotated
// away, tripping the server's reuse detection and logging the user out.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/**
 * Authenticated fetch. Attaches the Bearer access token, and on a 401 transparently
 * refreshes the access token once and retries. If refresh fails, tokens are cleared
 * and {@link AuthError} is thrown so the caller can redirect to the login screen.
 *
 * @param path API path relative to BASE_URL (e.g. "/entries").
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const access = await getAccessToken();
  const headers = new Headers(options.headers);
  if (access) headers.set('Authorization', `Bearer ${access}`);

  let res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    const newAccess = await refreshAccessToken();
    if (!newAccess) {
      await clearTokens();
      throw new AuthError();
    }
    headers.set('Authorization', `Bearer ${newAccess}`);
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  }

  return res;
}
