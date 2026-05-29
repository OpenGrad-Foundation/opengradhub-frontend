'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getManagerAnalytics,
  getAnalyticsSchools,
  getAnalyticsStudents,
  getTopicStrength,
  getProgrammeInsights,
  getAnalyticsFilterStates,
  getAnalyticsFilterDistricts,
  getAnalyticsFilterSchools,
  type AnalyticsStudentFilters,
  type ProgrammeInsightsFilters,
} from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 analytics read hooks. Memory-only, 5 min staleTime. */
export function useManagerAnalytics(courseId: string) {
  return useQuery({
    queryKey: qk.managerAnalytics(courseId),
    queryFn: () => getManagerAnalytics(courseId),
    enabled: !!courseId,
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

export function useProgrammeInsights(filters: ProgrammeInsightsFilters = {}) {
  return useQuery({
    queryKey: ["analytics", "insights", filters.programme ?? "all", filters.state ?? "all", filters.district ?? "all", filters.schoolId ?? "all"],
    queryFn: () => getProgrammeInsights(filters),
    staleTime: 60_000,  // 1 min client-side cache; server caches 15 min
  });
}

export function useAnalyticsFilterStates() {
  return useQuery({
    queryKey: ["analytics", "filters", "states"],
    queryFn: getAnalyticsFilterStates,
    staleTime: 5 * 60_000,
  });
}

export function useAnalyticsFilterDistricts(state?: string) {
  return useQuery({
    queryKey: ["analytics", "filters", "districts", state ?? "all"],
    queryFn: () => getAnalyticsFilterDistricts(state),
    staleTime: 5 * 60_000,
  });
}

export function useAnalyticsFilterSchools(state?: string, district?: string) {
  return useQuery({
    queryKey: ["analytics", "filters", "schools", state ?? "all", district ?? "all"],
    queryFn: () => getAnalyticsFilterSchools(state, district),
    staleTime: 5 * 60_000,
  });
}
