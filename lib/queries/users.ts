'use client';

import { useQuery } from '@tanstack/react-query';
import { getMe, getStaffProfile } from '../api';
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

/** Staff profile page. A 404 is a decision (out of scope / not found), not a blip. */
export function useStaffProfile(userId: string) {
  return useQuery({
    queryKey: qk.staffProfile(userId),
    queryFn: () => getStaffProfile(userId),
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
}
