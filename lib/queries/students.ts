'use client';

import { useQuery } from '@tanstack/react-query';
import { getStudentCourses } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 student-courses hook. Progress changes per lesson. */
export function useStudentCourses(studentId: string) {
  return useQuery({
    queryKey: qk.studentCourses(studentId),
    queryFn: () => getStudentCourses(studentId),
    enabled: !!studentId,
    staleTime: 2 * 60_000,
  });
}
