'use client';

import { useQuery } from '@tanstack/react-query';
import { getLiveClasses, getNextLiveClass, type LiveClassFilters } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 live-class hooks. Memory-only. */

/**
 * `filters` is optional and a bare call fetches the unfiltered list — which is
 * what the School confirmations tab and the class edit page need, since both
 * work over past and archived classes.
 */
export function useLiveClasses(filters?: LiveClassFilters) {
  return useQuery({
    queryKey: qk.liveClasses(filters as Record<string, unknown> | undefined),
    queryFn: () => getLiveClasses(filters),
    staleTime: 2 * 60_000,
  });
}

export function useNextLiveClass(studentId: string) {
  return useQuery({
    queryKey: qk.nextLiveClass(studentId),
    queryFn: () => getNextLiveClass(studentId),
    enabled: !!studentId,
    staleTime: 60_000,
  });
}
