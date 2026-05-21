import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { makeQueryClient } from '../../lib/queries/query-client';

describe('makeQueryClient', () => {
  it('returns a QueryClient instance', () => {
    expect(makeQueryClient()).toBeInstanceOf(QueryClient);
  });

  it('sets a sane default staleTime and disables refetchOnWindowFocus', () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.staleTime).toBeGreaterThan(0);
    expect(opts.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('limits query retries so a down backend fails fast', () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.retry).toBe(1);
  });
});
