'use client';

import { useQuery } from '@tanstack/react-query';
import { getResources } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 (IDB-persisted) resources hook. 30 min stale / 2 h gc. */
export function useResources(programmeType?: string) {
  return useQuery({
    queryKey: qk.resources(programmeType),
    queryFn: () => getResources(programmeType),
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
    persister: makeIdbPersister(),
  });
}
