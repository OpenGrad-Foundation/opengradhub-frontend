'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  archiveNotification,
  clearReadNotifications,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
} from '../api';
import { useInvalidate } from '../mutations/invalidation';
import { qk } from './keys';

// Freshness comes from the SSE stream (useRealtime) invalidating these keys on a
// server signal. The slow interval is only a safety net for events missed during
// a disconnect; it pauses when the tab is backgrounded (TanStack default).
const SAFETY_NET_MS = 5 * 60_000;

/** Layer 4 — Tier 2 notification hooks. SSE-driven; 5m safety net, no IDB. */
export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: getNotifications,
    staleTime: 30_000,
    refetchInterval: SAFETY_NET_MS,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.unreadCount(),
    queryFn: getUnreadCount,
    staleTime: 30_000,
    refetchInterval: SAFETY_NET_MS,
  });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      markNotificationRead(id, read),
    onSuccess: () => invalidate('notifications'),
  });
}

export function useArchiveNotification() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => archiveNotification(id),
    onSuccess: () => invalidate('notifications'),
  });
}

export function useClearRead() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () => clearReadNotifications(),
    onSuccess: () => invalidate('notifications'),
  });
}
