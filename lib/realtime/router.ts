/**
 * Realtime event router — maps SSE invalidation signals to React Query cache
 * invalidations. Pure and timer-injectable so it can be unit-tested without a
 * live EventSource (see router.spec.ts).
 *
 * - `notifications-changed` → invalidate immediately (per-user signal, no herd).
 * - `announcements-changed` → debounce + random 0–2s jitter before invalidating.
 *   A role broadcast hits many connected clients at once; spreading their
 *   refetches avoids a thundering herd on GET /announcements.
 * - `ping` / anything else → ignored (heartbeat).
 */
export type RealtimeRouterOptions = {
  invalidateNotifications: () => void;
  invalidateAnnouncements: () => void;
  /** Jitter in ms before an announcements refetch. Default: random 0–2000. */
  jitterMs?: () => number;
  /** Injectable timer (defaults to setTimeout) for deterministic tests. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
};

export type RealtimeRouter = {
  handle: (eventType?: string) => void;
  dispose: () => void;
};

export function createRealtimeRouter(opts: RealtimeRouterOptions): RealtimeRouter {
  const jitter = opts.jitterMs ?? (() => Math.floor(Math.random() * 2000));
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h));

  let pending: ReturnType<typeof setTimeout> | null = null;

  return {
    handle(eventType?: string) {
      if (eventType === 'notifications-changed') {
        opts.invalidateNotifications();
        return;
      }
      if (eventType === 'announcements-changed') {
        if (pending) clearTimer(pending);
        pending = setTimer(() => {
          pending = null;
          opts.invalidateAnnouncements();
        }, jitter());
      }
      // ping / unknown → ignore
    },
    dispose() {
      if (pending) {
        clearTimer(pending);
        pending = null;
      }
    },
  };
}
