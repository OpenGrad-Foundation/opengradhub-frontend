'use client';

import { useQuery } from '@tanstack/react-query';
import { getQuestionStats } from '../api';
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
