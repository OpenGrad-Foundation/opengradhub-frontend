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

/** Layer 4 — Tier 2 notification hooks. Near-live: 30s staleTime, no IDB. */
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
