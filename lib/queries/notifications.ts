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
// server signal. The old 5-min refetchInterval was a redundant safety net that
// polled on every page for every user (topbar-mounted) alongside SSE — removed.
/** Layer 4 — Tier 2 notification hooks. SSE-driven; no polling, no IDB. */
export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: getNotifications,
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: qk.unreadCount(),
    queryFn: getUnreadCount,
    staleTime: 30_000,
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
