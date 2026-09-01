import type { InboxItem } from './queries/inbox';

/**
 * Toast policy for the topbar bell.
 *
 * The baseline is a TIMESTAMP, not an item id. The id-based version broke on the
 * shape of the feed itself: useInboxFeed merges two independently-resolving
 * queries (announcements, IDB-persisted and instant; notifications, network-only)
 * so whichever settled first became "everything I have ever seen" and the other
 * one's entire backlog arrived looking brand new. That is what toast-stormed a
 * student with a pile of course assignments on login, and what made a
 * long-unread "Welcome to OpenGrad LMS" pop up on whatever route happened to
 * remount the topbar. A timestamp baseline is immune: an item is new only if it
 * is genuinely newer than the newest thing already accounted for, no matter
 * which query it came from or how many times the component remounts.
 *
 * The cap is the second half of the policy: one toast per new unread item melts
 * the page when a real burst lands, so cap the individual toasts and report the
 * remainder for a single summary toast.
 */
export const TOAST_CAP = 3;

/** Max rows rendered inside the bell dropdown — the full feed lives at /dashboard/inbox. */
export const DROPDOWN_CAP = 20;

/** Newest created_at in the feed. Items arrive newest-first, but don't assume it. */
export function latestTimestamp(items: InboxItem[]): string | undefined {
  let latest: string | undefined;
  for (const item of items) {
    if (latest === undefined || item.created_at > latest) latest = item.created_at;
  }
  return latest;
}

/**
 * Which items deserve a toast, given the newest timestamp already seen.
 *
 * `since === undefined` means no baseline has been established yet — the caller
 * has not finished its first load, so nothing is "new" and nothing toasts.
 */
export function computeInboxToasts(
  items: InboxItem[],
  since: string | undefined,
  cap: number = TOAST_CAP,
): { toasts: InboxItem[]; overflow: number } {
  if (items.length === 0 || since === undefined) return { toasts: [], overflow: 0 };

  const fresh = items
    .filter((i) => !i.is_read && i.created_at > since)
    .sort((p, q) => q.created_at.localeCompare(p.created_at));

  const toasts = fresh.slice(0, Math.max(0, cap));
  return { toasts, overflow: fresh.length - toasts.length };
}
