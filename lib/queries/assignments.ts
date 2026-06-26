'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssignments, getSubmissionQueue } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 assignments hook. Memory-only, 2 min staleTime. */
export function useAssignments() {
  return useQuery({
    queryKey: qk.assignments(),
    queryFn: () => getAssignments(),
    staleTime: 2 * 60_000,
  });
}

export function useSubmissionQueue(filters: {
  schoolId?: string;
  overdue?: boolean;
  status?: string;
  q?: string;
} = {}) {
  return useQuery({
    queryKey: qk.submissionQueue(filters),
    queryFn: () => getSubmissionQueue(filters),
    staleTime: 30_000,
  });
}
