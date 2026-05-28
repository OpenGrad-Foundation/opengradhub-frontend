'use client';

import { useQuery } from '@tanstack/react-query';
import { getBundles } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 (IDB-persisted) bundles hook. 5 min stale / 30 min gc. */
export function useBundles(studentId?: string) {
  return useQuery({
    queryKey: qk.bundles(studentId),
    queryFn: () => getBundles(studentId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    persister: makeIdbPersister(),
  });
}
