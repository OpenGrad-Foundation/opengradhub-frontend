'use client';

import { useQuery } from '@tanstack/react-query';
import { getCourses, getCourseById, getCourseOverview } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

export interface CoursesParams {
  programmeType?: string;
  studentId?: string;
  createdBy?: string;
  allStatuses?: boolean;
}

/**
 * Layer 4 — Tier 1 (IDB-persisted) course read hooks.
 * staleTime/gcTime from the data-tier table.
 */
export function useCourses(params: CoursesParams = {}) {
  return useQuery({
    queryKey: qk.courses(params as Record<string, unknown>),
    queryFn: () => getCourses(params.programmeType, params.studentId, params.createdBy, params.allStatuses),
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
    // NOT IDB-persisted: the list is role-filtered server-side (SUPER_ADMIN sees
    // more) but the role is not in the query key, so a persisted entry could
    // hydrate across roles after a re-login. Browser no-store doesn't cover IDB.
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: qk.course(id),
    queryFn: () => getCourseById(id),
    enabled: !!id,
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
    persister: makeIdbPersister(),
  });
}

export function useCourseOverview(courseId: string, studentId: string) {
  return useQuery({
    queryKey: qk.courseOverview(courseId, studentId),
    queryFn: () => getCourseOverview(courseId, studentId),
    enabled: !!courseId && !!studentId,
    staleTime: 2 * 60_000,
    gcTime: 2 * 60 * 60_000,
    persister: makeIdbPersister(),
  });
}
