'use client';

import { useQuery } from '@tanstack/react-query';
import { getAssignments } from '../api';
import { qk } from './keys';

/** Layer 4 — Tier 2 assignments hook. Memory-only, 2 min staleTime. */
export function useAssignments() {
  return useQuery({
    queryKey: qk.assignments(),
    queryFn: () => getAssignments(),
    staleTime: 2 * 60_000,
  });
}
