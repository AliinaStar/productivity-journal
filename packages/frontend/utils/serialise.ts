/**
 * Run tasks one after another, however many callers ask at once.
 *
 * `useSync()` is a hook, so every screen that calls it holds its own state and
 * none of them can see the others' in-flight work. Overlapping pushes are not
 * hypothetical: unlocking the phone fires both the foreground and the
 * reconnect handler in `useAutoSync`, and the Today and Goals screens each
 * push on focus. Two pushes read the same unsynced rows and send them both,
 * which is how one note reached the server three times.
 *
 * Module-level state is what makes this work — a queue held in a component
 * would be per-instance, which is the problem rather than the fix.
 */
export function createSerialiser() {
  let tail: Promise<unknown> = Promise.resolve();

  return function serialised<T>(work: () => Promise<T>): Promise<T> {
    // `.then(work, work)` runs the next task whether the previous one resolved
    // or rejected: a single failed push must not wedge every later push behind
    // it forever.
    const next = tail.then(work, work);
    // The tail swallows rejections so the chain itself stays healthy; the
    // caller still receives the real outcome through `next`.
    tail = next.catch(() => undefined);
    return next;
  };
}
