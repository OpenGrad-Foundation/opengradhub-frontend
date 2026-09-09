'use client';

import { useQuery } from '@tanstack/react-query';
import { getLiveClasses, getNextLiveClass, getAudiencePreview, type LiveClassFilters } from '../api';
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

/**
 * Audience size for a prospective class target. Debounced by the caller's own
 * state; `placeholderData` keeps the previous count on screen while a new one
 * loads, so the line does not flicker between every keystroke.
 */
export function useAudiencePreview(t: {
  course_id?: string;
  batch_ids?: string[];
}) {
  const enabled = !!t.course_id || !!t.batch_ids?.length;
  return useQuery({
    queryKey: qk.liveClassAudiencePreview(t as Record<string, unknown>),
    queryFn: () => getAudiencePreview(t),
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}
