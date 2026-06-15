'use client';

import { useQuery } from '@tanstack/react-query';
import { getCalendar } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 calendar hook. Memory-only, 2 min staleTime. */
export function useCalendar(from?: string, to?: string) {
  return useQuery({
    queryKey: qk.calendar(from, to),
    queryFn: () => getCalendar(from, to),
    staleTime: 2 * 60_000,
  });
}
