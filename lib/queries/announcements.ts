'use client';

import { useQuery } from '@tanstack/react-query';
import { getAnnouncements } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 announcements hook, keyed by role. */
export function useAnnouncements(role: string) {
  return useQuery({
    queryKey: qk.announcements(role),
    queryFn: () => getAnnouncements(role),
    enabled: !!role,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    persister: makeIdbPersister(),
  });
}
