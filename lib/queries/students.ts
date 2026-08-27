'use client';

import { useQuery } from '@tanstack/react-query';
import { getStudentCourses, getStudentProfile } from '../api';
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

/** Layer 4 — Tier 2 staff student-profile hook. Scope-checked server-side. */
export function useStudentProfile(studentId: string) {
  return useQuery({
    queryKey: qk.studentProfile(studentId),
    queryFn: () => getStudentProfile(studentId),
    enabled: !!studentId,
    staleTime: 2 * 60_000,
    retry: false,   // a 403/404 here is a decision, not a blip
  });
}
