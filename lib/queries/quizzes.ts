'use client';

import { useQuery } from '@tanstack/react-query';
import { getQuestionStats, getAvailableQuizzes, getQuizAttempts } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 quiz question stats. 5 min staleTime. */
export function useQuestionStats(quizId: string) {
  return useQuery({
    queryKey: ['og', 'quiz', quizId, 'question-stats'] as const,
    queryFn: () => getQuestionStats(quizId),
    enabled: !!quizId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    persister: makeIdbPersister(),
  });
}

/** Layer 4 — Tier 2 available-quizzes list. Memory-only, 2 min staleTime. */
export function useAvailableQuizzes() {
  return useQuery({
    queryKey: qk.availableQuizzes(),
    queryFn: () => getAvailableQuizzes(),
    staleTime: 2 * 60_000,
  });
}

/** Layer 4 — Tier 2 quiz attempts. Memory-only, 1 min staleTime. */
export function useQuizAttempts(quizId: string, studentId?: string) {
  return useQuery({
    queryKey: qk.quizAttempts(quizId, studentId),
    queryFn: () => getQuizAttempts(quizId, studentId),
    enabled: !!quizId,
    staleTime: 60_000,
  });
}
