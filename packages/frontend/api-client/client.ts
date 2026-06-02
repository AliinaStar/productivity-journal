import { BASE_URL } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from './auth-store';

/** Thrown when the session can no longer be authenticated and the user must sign in again. */
export class AuthError extends Error {
  constructor(message = 'Session expired.') {
    super(message);
    this.name = 'AuthError';
  }
}

async function refreshAccessToken(): Promise<string | null> {
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
  return data.access_token;
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
