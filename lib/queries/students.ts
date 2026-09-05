'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getStudentCourses,
  getStudentFacets,
  getStudentProfile,
  getStudentsDirectory,
  type StudentDirectoryFilters,
} from '../api';
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

/** Layer 4 — Tier 2. Every filter is part of the key or pages collide. */
export function useStudentsList(filters: StudentDirectoryFilters, enabled = true) {
  return useQuery({
    queryKey: qk.studentsDirectory(filters as Record<string, unknown>),
    queryFn: () => getStudentsDirectory(filters),
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,   // no flash to empty while paging
  });
}

/** Facets move only when someone's scope changes. */
export function useStudentFacets(enabled = true) {
  return useQuery({
    queryKey: qk.studentFacets(),
    queryFn: getStudentFacets,
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
