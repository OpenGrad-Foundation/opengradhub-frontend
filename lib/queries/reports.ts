'use client';

import { useQuery } from '@tanstack/react-query';
import { getStudentPerformanceHistory } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 student performance history. 5 min staleTime. */
export function useReportHistory(studentId: string) {
  return useQuery({
    queryKey: qk.reportHistory(studentId),
    queryFn: () => getStudentPerformanceHistory(studentId),
    enabled: !!studentId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    persister: makeIdbPersister(),
  });
}
