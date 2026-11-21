'use client';

import { useMemo } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useAnnouncements, useAnnouncementUnreadCount } from './announcements';
import { useNotifications, useUnreadCount as useNotificationUnreadCount } from './notifications';
import { retryAfterAt } from './retry';

export type InboxItem =
  | {
      source: 'announcement';
      id: string;
      title: string;
      body: string;
      created_at: string;
      is_read: boolean;
    }
  | {
      source: 'notification';
      id: string;
      type: string;
      title: string;
      body: string;
      created_at: string;
      is_read: boolean;
      link: string | null;
    };

function getInboxRetry(queries: UseQueryResult<unknown>[]) {
  const failed = queries.filter((query) => query.failureReason || query.error);
  return {
    isError: failed.length > 0,
    isFetching: failed.some((query) => query.isFetching),
    retryAt: Math.max(0, ...failed.map((query) => retryAfterAt(query.failureReason ?? query.error) ?? 0)),
    refetch: () => Promise.all(failed.map((query) => query.refetch({ cancelRefetch: false }))),
  };
}

/**
 * Unified inbox feed — merges announcements (role-scoped) and in-app notifications
 * (recipient-scoped), sorted newest-first.
 */
export function useInboxFeed(opts: { role: string }) {
  const a = useAnnouncements(opts.role);
  const n = useNotifications();

  const items = useMemo<InboxItem[]>(() => {
    const ann = (a.data ?? []).map((x): InboxItem => ({
      source: 'announcement',
      id: x.id,
      title: x.title,
      body: x.body,
      created_at: x.created_at,
      is_read: x.is_read,
    }));
    const not = (n.data ?? []).map((x): InboxItem => ({
      source: 'notification',
      id: x.id,
      type: x.type,
      title: x.title,
      body: x.body,
      created_at: x.triggered_at,
      is_read: x.is_read,
      link: x.link ?? null,
    }));
    return [...ann, ...not].sort((p, q) => q.created_at.localeCompare(p.created_at));
  }, [a.data, n.data]);

  return {
    items,
    isLoading: (!!opts.role && a.isPending) || n.isPending,
    ...getInboxRetry([a, n]),
    /**
     * Both halves of the feed succeeded. The toast baseline MUST NOT be taken before this: the two
     * queries settle at different times, and a baseline captured from whichever
     * arrived first makes the other one's backlog look brand new.
     *
     * Announcements are `enabled: !!role`, so this stays false until the current
     * user's role is known — deliberately. A disabled query has fetched nothing,
     * and treating "disabled" as "settled" reintroduces the exact race.
     */
    isSettled: a.isSuccess && n.isSuccess,
  };
}

/**
 * Combined unread badge count — notification unread + announcement unread.
 * useNotificationUnreadCount returns a raw number; useAnnouncementUnreadCount returns { count }.
 */
export function useInboxUnreadCount() {
  const n = useNotificationUnreadCount();
  const a = useAnnouncementUnreadCount();
  return {
    data: n.data !== undefined && a.data !== undefined ? { count: n.data + a.data.count } : undefined,
    isLoading: n.isLoading || a.isLoading,
    ...getInboxRetry([n, a]),
  };
}
