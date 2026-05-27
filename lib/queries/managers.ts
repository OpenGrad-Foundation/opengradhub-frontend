'use client';

import { useQuery } from '@tanstack/react-query';
import { getManagers } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 managers dropdown. Reference data, 1 h staleTime. */
export function useManagers(role: 'PROGRAM_MANAGER' | 'ZONAL_MANAGER') {
  return useQuery({
    queryKey: qk.managers(role),
    queryFn: () => getManagers(role),
    enabled: !!role,
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    persister: makeIdbPersister(),
  });
}
