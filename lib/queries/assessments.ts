'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssessmentsOverview, type AssessmentsOverviewFilters } from '../api';
import { qk } from './keys';

/**
 * Filters accepted by {@link useAssessmentsOverview}. Mirrors the api's
 * `AssessmentsOverviewFilters` (snake_case keys: course_id / bundle_id).
 */
export type AssessmentsOverviewParams = AssessmentsOverviewFilters;

/** Layer 4 — Tier 2 (memory) assessments-overview hook. 60 s staleTime. */
export function useAssessmentsOverview(params: AssessmentsOverviewParams = {}) {
  return useQuery({
    queryKey: qk.assessmentsOverview(params as Record<string, unknown>),
    queryFn: () => getAssessmentsOverview(params),
    staleTime: 60_000,
  });
}
