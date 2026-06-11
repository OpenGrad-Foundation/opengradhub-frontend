'use client';

import { useQuery } from '@tanstack/react-query';
import { getBatches, getBatchById } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';

/** Layer 4 — Tier 1 (IDB-persisted) batches list hook. 5 min stale / 30 min gc. */
export function useBatches(status?: 'ACTIVE' | 'ARCHIVED' | 'all') {
  return useQuery({
    queryKey: qk.batches(status),
    queryFn: () => getBatches(status),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    persister: makeIdbPersister(),
  });
}

/** Batch detail (members + content). Memory-only — mutation-heavy view. */
export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: qk.batch(id ?? ''),
    queryFn: () => getBatchById(id as string),
    enabled: Boolean(id),
    staleTime: 2 * 60_000,
  });
}
