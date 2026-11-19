/** Caps simultaneous long-lived streams per key (a user id). Process-local: with several web instances the cap applies per instance. */
export function createStreamLimiter(max: number) {
  const open = new Map<string, number>();
  return {
    /** Returns a release function, or null when the key already holds `max` streams. Releasing twice is harmless. */
    acquire(key: string): (() => void) | null {
      const n = open.get(key) ?? 0;
      if (n >= max) return null;
      open.set(key, n + 1);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const left = (open.get(key) ?? 1) - 1;
        if (left <= 0) open.delete(key); else open.set(key, left);
      };
    },
    count: (key: string) => open.get(key) ?? 0,
  };
}
export const MAX_STREAMS_PER_USER = 5;
