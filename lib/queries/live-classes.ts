'use client';

import { useQuery } from '@tanstack/react-query';
import { getLiveClasses, getNextLiveClass } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 live-class hooks. Memory-only. */
export function useLiveClasses() {
  return useQuery({
    queryKey: qk.liveClasses(),
    queryFn: () => getLiveClasses(),
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
