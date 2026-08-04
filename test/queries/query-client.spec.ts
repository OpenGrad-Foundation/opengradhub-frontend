import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { makeQueryClient } from '../../lib/queries/query-client';

describe('makeQueryClient', () => {
  it('returns a QueryClient instance', () => {
    expect(makeQueryClient()).toBeInstanceOf(QueryClient);
  });

  it('sets a sane default staleTime and refetches stale data on window focus', () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.staleTime).toBeGreaterThan(0);
    // Focus-refetch is gated on staleness by TanStack: fresh data (within
    // staleTime) is still served from cache; only stale data refetches on
    // tab refocus. See the rationale in lib/queries/query-client.ts.
    expect(opts.queries?.refetchOnWindowFocus).toBe(true);
  });

  it('limits query retries so a down backend fails fast', () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.retry).toBe(1);
  });
});
