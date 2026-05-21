'use client';

import { useQuery } from '@tanstack/react-query';
import { getNotifications, getUnreadCount } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 notification hooks. Near-live: 30s staleTime, no IDB. */
export function useNotifications(recipientId: string) {
  return useQuery({
    queryKey: qk.notifications(recipientId),
    queryFn: () => getNotifications(recipientId),
    enabled: !!recipientId,
    staleTime: 30_000,
  });
}

export function useUnreadCount(recipientId: string) {
  return useQuery({
    queryKey: qk.unreadCount(recipientId),
    queryFn: () => getUnreadCount(recipientId),
    enabled: !!recipientId,
    staleTime: 30_000,
  });
}
