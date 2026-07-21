function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// Current streak: consecutive days with at least one entry, walking back from
// today (or from yesterday if nothing was logged yet today).
export function computeStreak(dateNotes: string[]): number {
  const days = new Set(dateNotes);
  const cursor = new Date();
  if (!days.has(todayIso())) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (;;) {
    const iso = cursor.toISOString().split('T')[0];
    if (!days.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
