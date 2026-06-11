'use client';

import { useMemo } from 'react';
import { useAnnouncements, useAnnouncementUnreadCount } from './announcements';
import { useNotifications, useUnreadCount as useNotificationUnreadCount } from './notifications';

export type InboxItem =
  | {
      source: 'announcement';
      id: string;
      title: string;
      body: string;
      created_at: string;
      // TODO: hydrate is_read from BE — /announcements endpoint does not return is_read yet
      is_read: boolean;
    }
  | {
      source: 'notification';
      id: string;
      title: string;
      body: string;
      created_at: string;
      is_read: boolean;
    };

/**
 * Unified inbox feed — merges announcements (role-scoped) and in-app notifications
 * (recipient-scoped), sorted newest-first.
 */
export function useInboxFeed(opts: { role: string; recipientId: string }) {
  const a = useAnnouncements(opts.role);
  const n = useNotifications(opts.recipientId);

  const items = useMemo<InboxItem[]>(() => {
    const ann = (a.data ?? []).map((x): InboxItem => ({
      source: 'announcement',
      id: x.id,
      title: x.title,
      body: x.body,
      created_at: x.created_at,
      // is_read is not yet returned by the BE; bridge with false until hydrated
      is_read: (x as unknown as { is_read?: boolean }).is_read ?? false,
    }));
    const not = (n.data ?? []).map((x): InboxItem => ({
      source: 'notification',
      id: x.id,
      title: x.title,
      body: x.body,
      created_at: x.triggered_at,
      is_read: x.is_read,
    }));
    return [...ann, ...not].sort((p, q) => q.created_at.localeCompare(p.created_at));
  }, [a.data, n.data]);

  return {
    items,
    isLoading: a.isLoading || n.isLoading,
    isError: a.isError || n.isError,
  };
}

/**
 * Combined unread badge count — notification unread + announcement unread.
 * useNotificationUnreadCount returns a raw number; useAnnouncementUnreadCount returns { count }.
 */
export function useInboxUnreadCount(recipientId: string) {
  const n = useNotificationUnreadCount(recipientId);
  const a = useAnnouncementUnreadCount();
  return {
    data: { count: (n.data ?? 0) + (a.data?.count ?? 0) },
    isLoading: n.isLoading || a.isLoading,
  };
}
