'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getAdminAnalytics,
  getManagerAnalytics,
  getFellowAnalytics,
  getAnalyticsSchools,
  getAnalyticsStudents,
  getTopicStrength,
  type AnalyticsStudentFilters,
} from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 analytics read hooks. Memory-only, 5 min staleTime. */
export function useAdminAnalytics() {
  return useQuery({
    queryKey: qk.adminAnalytics(),
    queryFn: () => getAdminAnalytics(),
    staleTime: 5 * 60_000,
  });
}

export function useManagerAnalytics(courseId?: string) {
  return useQuery({
    queryKey: qk.managerAnalytics(courseId),
    queryFn: () => getManagerAnalytics(courseId),
    staleTime: 5 * 60_000,
  });
}

export function useFellowAnalytics() {
  return useQuery({
    queryKey: qk.fellowAnalytics(),
    queryFn: () => getFellowAnalytics(),
    staleTime: 5 * 60_000,
  });
}

export function useAnalyticsSchools() {
  return useQuery({
    queryKey: qk.analyticsSchools(),
    queryFn: () => getAnalyticsSchools(),
    staleTime: 5 * 60_000,
  });
}

export function useAnalyticsStudents(filters: AnalyticsStudentFilters = {}) {
  return useQuery({
    queryKey: qk.analyticsStudents(filters as Record<string, unknown>),
    queryFn: () => getAnalyticsStudents(filters),
    staleTime: 5 * 60_000,
  });
}

export function useTopicStrength(studentId: string) {
  return useQuery({
    queryKey: qk.topicStrength(studentId),
    queryFn: () => getTopicStrength(studentId),
    enabled: !!studentId,
    staleTime: 5 * 60_000,
  });
}
