'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { getAnnouncements, getAnnouncementUnreadCount, markAnnouncementRead } from '../api';
import { useInvalidate } from '../mutations/invalidation';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

// Freshness now comes from the SSE stream (useRealtime) invalidating these keys
// on a server signal. The slow interval is only a safety net for events missed
// during a disconnect; it pauses when the tab is backgrounded (TanStack default).
const SAFETY_NET_MS = 5 * 60_000;

/** Layer 4 — Tier 1 announcements hook, keyed by role. */
export function useAnnouncements(role: string) {
  return useQuery({
    queryKey: qk.announcements(role),
    queryFn: () => getAnnouncements(role),
    enabled: !!role,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: SAFETY_NET_MS,
    persister: makeIdbPersister(),
  });
}

/** Layer 4 — Tier 2 unread-count hook for announcements. SSE-driven; 5m safety net. */
export function useAnnouncementUnreadCount() {
  return useQuery({
    queryKey: qk.announcementUnreadCount(),
    queryFn: getAnnouncementUnreadCount,
    staleTime: 30_000,
    refetchInterval: SAFETY_NET_MS,
  });
}

/** Mark a single announcement as read, then invalidate announcement + inbox caches. */
export function useMarkAnnouncementRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => markAnnouncementRead(id),
    onSuccess: () => {
      invalidate('announcements');
    },
  });
}
