import { describe, it, expect } from 'vitest';
import { computeInboxToasts, latestTimestamp, TOAST_CAP } from '@/lib/inbox-toast';
import type { InboxItem } from '@/lib/queries/inbox';

function notif(id: string, createdAt: string, isRead = false): InboxItem {
  return {
    source: 'notification',
    id,
    type: 'GENERIC',
    title: `t-${id}`,
    body: 'b',
    created_at: createdAt,
    is_read: isRead,
    link: null,
  };
}

function ann(id: string, createdAt: string, isRead = false): InboxItem {
  return { source: 'announcement', id, title: `a-${id}`, body: 'b', created_at: createdAt, is_read: isRead };
}

// items arrive newest-first, same as useInboxFeed
describe('computeInboxToasts', () => {
  it('toasts every unread item newer than the baseline', () => {
    const items = [notif('c', '2026-08-10T03:00Z'), notif('b', '2026-08-10T02:00Z'), notif('a', '2026-08-10T01:00Z')];
    const { toasts, overflow } = computeInboxToasts(items, '2026-08-10T01:00Z');
    expect(toasts.map((t) => t.id)).toEqual(['c', 'b']);
    expect(overflow).toBe(0);
  });

  it('caps toasts and reports the overflow count', () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) => notif(`new-${i}`, `2026-08-10T0${9 - Math.floor(i / 2)}:0${i % 10}Z`)),
      notif('old', '2026-08-01T00:00Z'),
    ];
    const { toasts, overflow } = computeInboxToasts(items, '2026-08-01T00:00Z');
    expect(toasts).toHaveLength(TOAST_CAP);
    expect(overflow).toBe(10 - TOAST_CAP);
  });

  it('skips items already read', () => {
    const items = [
      notif('c', '2026-08-10T03:00Z', true),
      notif('b', '2026-08-10T02:00Z'),
      notif('a', '2026-08-10T01:00Z'),
    ];
    const { toasts, overflow } = computeInboxToasts(items, '2026-08-10T01:00Z');
    expect(toasts.map((t) => t.id)).toEqual(['b']);
    expect(overflow).toBe(0);
  });

  it('toasts nothing before a baseline exists', () => {
    const items = [notif('c', '2026-08-10T03:00Z'), notif('b', '2026-08-10T02:00Z')];
    expect(computeInboxToasts(items, undefined)).toEqual({ toasts: [], overflow: 0 });
  });

  it('returns nothing for an empty list', () => {
    const { toasts, overflow } = computeInboxToasts([], undefined);
    expect(toasts).toEqual([]);
    expect(overflow).toBe(0);
  });

  // The login-storm regression. The baseline was established from the
  // announcements half of the feed (IDB-persisted, resolves first); the whole
  // notifications backlog then arrived and every row of it looked brand new.
  // With a timestamp baseline taken at first settle, none of it toasts.
  it('does not toast a backlog that predates the baseline, whichever query it came from', () => {
    const backlog = [
      ...Array.from({ length: 40 }, (_, i) =>
        notif(`course-${i}`, `2026-08-09T10:${String(i).padStart(2, '0')}:00Z`)),
      ann('welcome-era', '2026-08-09T09:00:00Z'),
    ];
    const baseline = latestTimestamp(backlog);
    expect(computeInboxToasts(backlog, baseline)).toEqual({ toasts: [], overflow: 0 });
  });

  // The "welcome notification appears at random" regression: an old unread row
  // resurfacing (a remount, a refetch) is still older than the baseline.
  it('does not toast an old unread item that reappears after a remount', () => {
    const welcome = notif('welcome', '2026-07-01T00:00:00Z');
    const items = [notif('recent', '2026-08-10T00:00:00Z'), welcome];
    const baseline = latestTimestamp(items);
    expect(computeInboxToasts(items, baseline).toasts).toEqual([]);
    // …and it stays quiet when the same feed is re-delivered.
    expect(computeInboxToasts([...items], baseline).toasts).toEqual([]);
  });

  it('toasts a roll-up row again once its timestamp is bumped', () => {
    const first = [notif('rollup', '2026-08-10T01:00:00Z')];
    const baseline = latestTimestamp(first)!;
    // Same id, new triggered_at — the backend incremented the roll-up.
    const bumped = [notif('rollup', '2026-08-10T02:00:00Z')];
    expect(computeInboxToasts(bumped, baseline).toasts.map((t) => t.id)).toEqual(['rollup']);
  });
});

describe('latestTimestamp', () => {
  it('is undefined for an empty feed', () => {
    expect(latestTimestamp([])).toBeUndefined();
  });

  it('finds the newest regardless of array order', () => {
    const items = [notif('a', '2026-08-01T00:00Z'), notif('b', '2026-08-12T00:00Z'), notif('c', '2026-08-05T00:00Z')];
    expect(latestTimestamp(items)).toBe('2026-08-12T00:00Z');
  });
});
