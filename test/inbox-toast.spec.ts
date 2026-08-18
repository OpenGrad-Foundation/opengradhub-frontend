import { describe, it, expect } from 'vitest';
import { computeInboxToasts, TOAST_CAP } from '@/lib/inbox-toast';
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

// items arrive newest-first, same as useInboxFeed
describe('computeInboxToasts', () => {
  it('toasts every new unread item when under the cap', () => {
    const items = [notif('c', '2026-08-10T03:00Z'), notif('b', '2026-08-10T02:00Z'), notif('a', '2026-08-10T01:00Z')];
    const { toasts, overflow } = computeInboxToasts(items, 'a');
    expect(toasts.map((t) => t.id)).toEqual(['c', 'b']);
    expect(overflow).toBe(0);
  });

  it('caps toasts and reports the overflow count', () => {
    const items = [
      ...Array.from({ length: 10 }, (_, i) => notif(`new-${i}`, `2026-08-10T0${9 - Math.floor(i / 2)}:0${i % 10}Z`)),
      notif('old', '2026-08-01T00:00Z'),
    ];
    const { toasts, overflow } = computeInboxToasts(items, 'old');
    expect(toasts).toHaveLength(TOAST_CAP);
    expect(overflow).toBe(10 - TOAST_CAP);
  });

  it('skips items already read', () => {
    const items = [
      notif('c', '2026-08-10T03:00Z', true),
      notif('b', '2026-08-10T02:00Z'),
      notif('a', '2026-08-10T01:00Z'),
    ];
    const { toasts, overflow } = computeInboxToasts(items, 'a');
    expect(toasts.map((t) => t.id)).toEqual(['b']);
    expect(overflow).toBe(0);
  });

  it('falls back to the single newest item when the previous latest left the list', () => {
    const items = [notif('c', '2026-08-10T03:00Z'), notif('b', '2026-08-10T02:00Z')];
    const { toasts, overflow } = computeInboxToasts(items, 'gone');
    expect(toasts.map((t) => t.id)).toEqual(['c']);
    expect(overflow).toBe(0);
  });

  it('returns nothing for an empty list', () => {
    const { toasts, overflow } = computeInboxToasts([], undefined);
    expect(toasts).toEqual([]);
    expect(overflow).toBe(0);
  });
});
