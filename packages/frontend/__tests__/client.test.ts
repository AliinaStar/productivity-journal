jest.mock('@/api-client/config', () => ({ BASE_URL: 'http://test' }));

const store = {
  access: 'access-1' as string | null,
  refresh: 'refresh-1' as string | null,
};

jest.mock('@/api-client/auth-store', () => ({
  getAccessToken: jest.fn(async () => store.access),
  getRefreshToken: jest.fn(async () => store.refresh),
  setAccessToken: jest.fn(async (t: string) => { store.access = t; }),
  setRefreshToken: jest.fn(async (t: string) => { store.refresh = t; }),
  clearTokens: jest.fn(async () => { store.access = null; store.refresh = null; }),
}));

import { apiFetch, AuthError, logout } from '@/api-client/client';
import * as authStore from '@/api-client/auth-store';

function jsonResponse(status: number, body: any = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  store.access = 'access-1';
  store.refresh = 'refresh-1';
  jest.clearAllMocks();
});

describe('apiFetch', () => {
  it('attaches the Bearer access token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    (global as any).fetch = fetchMock;

    await apiFetch('/goals');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://test/goals');
    expect((options.headers as Headers).get('Authorization')).toBe('Bearer access-1');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))                       // initial call
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'access-2', refresh_token: 'refresh-2' })) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));        // retry
    (global as any).fetch = fetchMock;

    const res = await apiFetch('/goals');

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(authStore.setAccessToken).toHaveBeenCalledWith('access-2');
    // The rotated refresh token is persisted for the next exchange.
    expect(authStore.setRefreshToken).toHaveBeenCalledWith('refresh-2');
    // Retry carried the refreshed token.
    const retryHeaders = fetchMock.mock.calls[2][1].headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer access-2');
  });

  it('shares a single refresh across concurrent 401s', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))                       // request A initial
      .mockResolvedValueOnce(jsonResponse(401))                       // request B initial
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'access-2', refresh_token: 'refresh-2' })) // single /auth/refresh
      .mockResolvedValue(jsonResponse(200, { ok: true }));           // retries
    (global as any).fetch = fetchMock;

    await Promise.all([apiFetch('/goals'), apiFetch('/entries')]);

    // Only one /auth/refresh call despite two concurrent 401s.
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => url === 'http://test/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears tokens and throws AuthError when refresh fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))   // initial call
      .mockResolvedValueOnce(jsonResponse(401));  // /auth/refresh fails
    (global as any).fetch = fetchMock;

    await expect(apiFetch('/goals')).rejects.toBeInstanceOf(AuthError);
    expect(authStore.clearTokens).toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('revokes the refresh token server-side and clears tokens', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(204));
    (global as any).fetch = fetchMock;

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://test/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(authStore.clearTokens).toHaveBeenCalled();
  });
});
