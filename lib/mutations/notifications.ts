'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAllNotificationsRead } from '../api';
import { qk } from '../queries/keys';

/**
 * Layer 4 — mark-all-read mutation. Invalidates both the list and the
 * unread-count query for the recipient so the badge updates immediately.
 */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recipientId: string) => markAllNotificationsRead(recipientId),
    onSuccess: (_data, recipientId) => {
      void qc.invalidateQueries({ queryKey: qk.notifications(recipientId) });
      void qc.invalidateQueries({ queryKey: qk.unreadCount(recipientId) });
    },
  });
}
