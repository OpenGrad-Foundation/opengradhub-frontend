import { describe, it, expect, vi } from 'vitest';
import { createRealtimeRouter } from '@/lib/realtime/router';

// Deterministic timer harness — no real setTimeout, so debounce/jitter is
// observable synchronously via flush().
function fakeTimers() {
  let nextId = 1;
  const timers = new Map<number, () => void>();
  return {
    setTimer: (fn: () => void) => {
      const id = nextId++;
      timers.set(id, fn);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (h: ReturnType<typeof setTimeout>) => {
      timers.delete(h as unknown as number);
    },
    flush: () => {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    pending: () => timers.size,
  };
}

function makeRouter(timers = fakeTimers()) {
  const invalidateNotifications = vi.fn();
  const invalidateAnnouncements = vi.fn();
  const router = createRealtimeRouter({
    invalidateNotifications,
    invalidateAnnouncements,
    jitterMs: () => 0,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return { router, timers, invalidateNotifications, invalidateAnnouncements };
}

describe('createRealtimeRouter', () => {
  it('invalidates notifications immediately on notifications-changed', () => {
    const { router, invalidateNotifications, invalidateAnnouncements } = makeRouter();
    router.handle('notifications-changed');
    expect(invalidateNotifications).toHaveBeenCalledOnce();
    expect(invalidateAnnouncements).not.toHaveBeenCalled();
  });

  it('debounces + defers announcements-changed behind the jitter timer', () => {
    const { router, timers, invalidateAnnouncements } = makeRouter();
    router.handle('announcements-changed');
    // Not yet — waiting out the jitter window.
    expect(invalidateAnnouncements).not.toHaveBeenCalled();
    timers.flush();
    expect(invalidateAnnouncements).toHaveBeenCalledOnce();
  });

  it('collapses a burst of announcements-changed into a single invalidate', () => {
    const { router, timers, invalidateAnnouncements } = makeRouter();
    router.handle('announcements-changed');
    router.handle('announcements-changed');
    router.handle('announcements-changed');
    expect(timers.pending()).toBe(1); // earlier timers cleared
    timers.flush();
    expect(invalidateAnnouncements).toHaveBeenCalledOnce();
  });

  it('absorbs a notifications-changed burst: one leading + one trailing invalidate', () => {
    // A bulk send (cron escalation, scoped campaign) emits one SSE event per
    // inserted row. Without a cooldown every event refetched the list + count.
    const { router, timers, invalidateNotifications } = makeRouter();
    for (let i = 0; i < 10; i++) router.handle('notifications-changed');
    expect(invalidateNotifications).toHaveBeenCalledOnce(); // leading edge only
    timers.flush(); // cooldown expires → single trailing catch-up
    expect(invalidateNotifications).toHaveBeenCalledTimes(2);
  });

  it('single notifications-changed schedules no trailing invalidate', () => {
    const { router, timers, invalidateNotifications } = makeRouter();
    router.handle('notifications-changed');
    timers.flush();
    expect(invalidateNotifications).toHaveBeenCalledOnce();
  });

  it('dispose cancels a pending notifications trailing invalidate', () => {
    const { router, timers, invalidateNotifications } = makeRouter();
    router.handle('notifications-changed');
    router.handle('notifications-changed'); // marks trailing work pending
    router.dispose();
    timers.flush();
    expect(invalidateNotifications).toHaveBeenCalledOnce();
  });

  it('ignores ping and unknown events', () => {
    const { router, timers, invalidateNotifications, invalidateAnnouncements } = makeRouter();
    router.handle('ping');
    router.handle(undefined);
    router.handle('something-else');
    expect(timers.pending()).toBe(0);
    expect(invalidateNotifications).not.toHaveBeenCalled();
    expect(invalidateAnnouncements).not.toHaveBeenCalled();
  });

  it('dispose cancels a pending announcements invalidate', () => {
    const { router, timers, invalidateAnnouncements } = makeRouter();
    router.handle('announcements-changed');
    router.dispose();
    timers.flush();
    expect(invalidateAnnouncements).not.toHaveBeenCalled();
  });
});
