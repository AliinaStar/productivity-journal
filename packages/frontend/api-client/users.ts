import { ApiError, apiFetch } from './client';

/**
 * Report the device's IANA timezone (e.g. "Europe/Kyiv") to the server.
 *
 * The backend resolves week boundaries in this zone — it decides both how
 * long an entry stays editable and when reports are generated. Until a device
 * reports one the account is read as UTC, which is what every account did
 * before the column existed.
 */
export async function updateTimezone(timezone: string): Promise<void> {
  const res = await apiFetch('/users/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timezone }),
  });
  if (!res.ok) throw new ApiError(res.status, `Failed to update timezone: ${res.status}`);
}

/** The device's current IANA zone, or null if the platform won't say. */
export function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
