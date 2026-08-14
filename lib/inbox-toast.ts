import type { InboxItem } from './queries/inbox';

/**
 * Toast policy for the topbar bell. One toast per new unread item is a browser
 * killer: after a stale IDB snapshot a fresh fetch can carry weeks of unread,
 * and mounting hundreds of toasts at once froze the page. Cap the individual
 * toasts and report the remainder so the caller can show one summary instead.
 */
export const TOAST_CAP = 3;

/** Max rows rendered inside the bell dropdown — the full feed lives at /dashboard/inbox. */
export const DROPDOWN_CAP = 20;

export function computeInboxToasts(
  items: InboxItem[],
  previousLatestId: string | undefined,
  cap: number = TOAST_CAP,
): { toasts: InboxItem[]; overflow: number } {
  if (items.length === 0) return { toasts: [], overflow: 0 };

  const previousLatest = items.find((i) => i.id === previousLatestId);
  const newItems = previousLatest
    ? items.filter((i) => i.created_at > previousLatest.created_at)
    : [items[0]];

  const unread = newItems.filter((i) => !i.is_read);
  const toasts = unread.slice(0, cap);
  return { toasts, overflow: unread.length - toasts.length };
}
