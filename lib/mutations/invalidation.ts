'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Layer 4 — central mutation→invalidation map.
 *
 * Problem this solves: most writes happen via direct `api.*` calls scattered
 * across pages. They mutated the DB but never told TanStack Query which cached
 * reads went stale, so other views kept serving old data until staleTime
 * expired. This map is the single place that knows, for a given write domain,
 * every query-key prefix that may now be stale.
 *
 * Prefixes are intentionally BROAD. TanStack matches query keys by prefix, so
 * ['og','courses'] drops every param variant of the course list in one call.
 * Over-invalidation only triggers a cheap background refetch; under-invalidation
 * leaves stale data on screen — the bug we're fixing. When in doubt, list more.
 */
const DOMAIN_KEYS = {
  // course content: lists, detail, overview, lessons, plus anything derived
  courses: [['og', 'courses'], ['og', 'course'], ['og', 'lesson'], ['og', 'student'], ['og', 'analytics'], ['og', 'dashboard']],
  // user CRUD / role / archive — busts the managers list and authz-derived views
  users: [['og', 'user'], ['og', 'managers'], ['og', 'analytics'], ['og', 'dashboard']],
  // school CRUD / fellow assignment
  schools: [['og', 'schools'], ['og', 'managers'], ['og', 'analytics']],
  announcements: [['og', 'announcements'], ['og', 'analytics'], ['og', 'dashboard'], ['og', 'inbox']],
  // quiz authoring (create/update/publish/sections/questions)
  quizzes: [['og', 'quizzes'], ['og', 'quiz'], ['og', 'quiz-attempts'], ['og', 'analytics'], ['og', 'dashboard']],
  // a student submitting an attempt
  quizAttempt: [['og', 'quiz'], ['og', 'quiz-attempts'], ['og', 'student'], ['og', 'analytics'], ['og', 'dashboard']],
  bundles: [['og', 'bundles'], ['og', 'student'], ['og', 'dashboard']],
  // batch CRUD / membership / content assignment — cascades write
  // course/bundle enrolments, so student views + rosters + analytics go stale
  batches: [['og', 'batches'], ['og', 'bundles'], ['og', 'student'], ['og', 'courses'], ['og', 'course'], ['og', 'analytics'], ['og', 'dashboard']],
  assignments: [['og', 'assignments'], ['og', 'analytics'], ['og', 'dashboard']],
  calendar: [['og', 'calendar'], ['og', 'live-classes'], ['og', 'dashboard']],
  resources: [['og', 'resources']],
  doubts: [['og', 'doubts'], ['og', 'dashboard']],
  // enrolment changes (assign course, bulk enrol/remove) — affect both the
  // student's view and roster/analytics
  enrolment: [['og', 'student'], ['og', 'courses'], ['og', 'course'], ['og', 'analytics'], ['og', 'dashboard']],
  // lesson progress tick — affects course overview, student dashboards, analytics
  lessonProgress: [['og', 'course'], ['og', 'lesson'], ['og', 'student'], ['og', 'analytics'], ['og', 'dashboard']],
} as const;

export type MutationDomain = keyof typeof DOMAIN_KEYS;

/**
 * Returns an `invalidate(...domains)` function. Call it after any write:
 *
 *   const invalidate = useInvalidate();
 *   await updateUser(id, payload);
 *   invalidate('users');
 *
 * Pass multiple domains when a write crosses concerns:
 *   invalidate('schools', 'users');
 */
export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback(
    (...domains: MutationDomain[]) => {
      const seen = new Set<string>();
      for (const domain of domains) {
        for (const key of DOMAIN_KEYS[domain]) {
          const id = key.join('|');
          if (seen.has(id)) continue;
          seen.add(id);
          void qc.invalidateQueries({ queryKey: key });
        }
      }
    },
    [qc],
  );
}
