'use client';

import { useQuery } from '@tanstack/react-query';
import { getDoubts } from '../api';
import { qk } from './keys';

export interface StaffDoubtsFilters {
  status?: string;
  programme?: string;
  school?: string;
  q?: string;
  page?: number;
  size?: number;
}

/**
 * Layer 4 — Tier 2 (memory) staff doubts list. 30 s staleTime.
 *
 * NOTE: `getDoubts` scopes results by `req.auth` on the backend and ignores any
 * positional args, so the filters here only participate in the query key (cache
 * partitioning). The fetch itself is unparameterised.
 */
export function useStaffDoubts(filters: StaffDoubtsFilters = {}) {
  return useQuery({
    queryKey: qk.staffDoubts(filters as Record<string, unknown>),
    queryFn: () => getDoubts(),
    staleTime: 30_000,
  });
}
