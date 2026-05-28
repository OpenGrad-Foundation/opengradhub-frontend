'use client';

import { useQuery } from '@tanstack/react-query';
import { getStudentEnrolments } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 student-enrolments hook. Memory-only, 2 min staleTime. */
export function useStudentEnrolments(studentId: string) {
  return useQuery({
    queryKey: qk.studentEnrolments(studentId),
    queryFn: () => getStudentEnrolments(studentId),
    enabled: !!studentId,
    staleTime: 2 * 60_000,
  });
}
