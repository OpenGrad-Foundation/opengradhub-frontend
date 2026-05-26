'use client';

import { useQuery } from '@tanstack/react-query';
import { getLessonById } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 lesson read hook. Content is immutable once published. */
export function useLesson(lessonId: string) {
  return useQuery({
    queryKey: qk.lesson(lessonId),
    queryFn: () => getLessonById(lessonId),
    enabled: !!lessonId,
    staleTime: 60 * 60_000,
    gcTime: 4 * 60 * 60_000,
    persister: makeIdbPersister(),
  });
}
