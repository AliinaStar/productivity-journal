/** Format a Date as 'YYYY-MM-DD' using the device's own calendar. */
export function toIsoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Today as 'YYYY-MM-DD' in the device's timezone.
 *
 * Deliberately not `toISOString().split('T')[0]`, which yields the *UTC*
 * date. East of UTC that files a note written just after midnight under
 * yesterday; west of it, a note written late in the evening under tomorrow.
 * Which day a note belongs to decides which week's report quotes it and how
 * long it stays editable, so the off-by-one is not cosmetic — and the server
 * now resolves week boundaries in the user's zone, so the client has to
 * agree with it.
 */
export function todayIso(): string {
  return toIsoDate(new Date());
}

/** Parse a 'YYYY-MM-DD' string as local midnight rather than UTC midnight. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}
