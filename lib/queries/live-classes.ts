'use client';

import { useQuery } from '@tanstack/react-query';
import { getLiveClasses, getNextLiveClass, getLiveClassAttendees } from '../api';
import { getLiveClassRoster, getAttendanceSummary, getStudentAttendance } from '../api-attendance';
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

export function useLiveClassAttendees(id: string) {
  return useQuery({
    queryKey: qk.liveClassAttendees(id),
    queryFn: () => getLiveClassAttendees(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useLiveClassRoster(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.liveClassRoster(id),
    queryFn: () => getLiveClassRoster(id),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}

export function useAttendanceSummary(params: {
  course_id?: string; batch_id?: string; from?: string; to?: string; page?: number; limit?: number;
}) {
  const enabled = !!params.course_id || !!params.batch_id;
  return useQuery({
    queryKey: qk.attendanceSummary(params),
    queryFn: () => getAttendanceSummary(params),
    enabled,
    staleTime: 60_000,
  });
}

export function useStudentAttendance(studentId: string) {
  return useQuery({
    queryKey: qk.studentAttendance(studentId),
    queryFn: () => getStudentAttendance(studentId),
    enabled: !!studentId,
    staleTime: 60_000,
  });
}
