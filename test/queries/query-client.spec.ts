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
    // Focus-refetch is enabled but staleness-gated: fresh data stays cached,
    // only past-staleTime queries refetch on tab return (caching strategy v2).
    expect(opts.queries?.refetchOnWindowFocus).toBe(true);
  });

  it('limits query retries so a down backend fails fast', () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.retry).toBe(1);
  });
});
