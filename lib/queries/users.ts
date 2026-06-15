'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 current-user hook. Profile rarely changes mid-session. */
export function useCurrentUser(userId: string) {
  return useQuery({
    queryKey: qk.user(userId),
    queryFn: () => getMe(userId),
    enabled: !!userId,
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    persister: makeIdbPersister(),
  });
}
