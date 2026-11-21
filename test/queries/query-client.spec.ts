import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { makeQueryClient } from '../../lib/queries/query-client';
import { ApiError, getNotifications, getUnreadCount, getNextLiveClass } from '../../lib/api';

describe('makeQueryClient', () => {
  it('returns a QueryClient instance', () => {
    expect(makeQueryClient()).toBeInstanceOf(QueryClient);
  });

  it('sets a sane default staleTime and disables refetchOnWindowFocus', () => {
    const opts = makeQueryClient().getDefaultOptions();
    expect(opts.queries?.staleTime).toBeGreaterThan(0);
    // Focus-refetch is off by default (caching strategy v2): the SSE stream
    // invalidates affected keys on server changes, so a blanket focus-refetch
    // would only add load (10-18 refetches per focus on dense pages like
    // tracker). Hooks that still need it opt back in individually.
    expect(opts.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('limits query retries so a down backend fails fast', () => {
    const retry = makeQueryClient().getDefaultOptions().queries!.retry as (count: number, error: Error) => boolean;
    expect(retry(0, new ApiError('Unavailable', 503))).toBe(true);
    expect(retry(1, new ApiError('Unavailable', 503))).toBe(false);
    for (const status of [400, 401, 403, 404]) {
      expect(retry(0, new ApiError('Request failed', status))).toBe(false);
    }
  });

  it('waits for Retry-After before reissuing a rate-limited query', async () => {
    vi.useFakeTimers();
    const client = makeQueryClient();
    const queryFn = vi.fn()
      .mockRejectedValueOnce(new ApiError('Busy', new Response(null, { status: 429, headers: { 'Retry-After': '12' } })))
      .mockResolvedValueOnce('ok');
    try {
      const result = client.fetchQuery({ queryKey: ['429'], queryFn });
      await vi.advanceTimersByTimeAsync(11_999);
      expect(queryFn).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(251);
      await expect(result).resolves.toBe('ok');
      expect(queryFn).toHaveBeenCalledTimes(2);
    } finally {
      client.clear();
      vi.useRealTimers();
    }
  });

  it('does not automate waits above the cap or shorten the server deadline', () => {
    const retry = makeQueryClient().getDefaultOptions().queries!.retry as (count: number, error: Error) => boolean;
    const error = new ApiError('Busy', new Response(null, { status: 429, headers: { 'Retry-After': '300' } }));
    expect(retry(0, error)).toBe(false);
    expect(error.retryAfterMs).toBe(300_000);
    expect(error.retryAfterAt).toBeGreaterThan(Date.now() + 299_000);
  });

  it('keeps loaded profile data when a refetch fails with a transient response', async () => {
    const client = makeQueryClient();
    const queryKey = ['og', 'user', 'self', 'user_abc'];
    const profile = { user: { id: 'user_abc' } };
    client.setQueryData(queryKey, profile);
    const error = new ApiError('Busy', new Response(null, { status: 429, headers: { 'Retry-After': '300' } }));
    try {
      await expect(client.fetchQuery({ queryKey, queryFn: () => Promise.reject(error), staleTime: 0 })).rejects.toBe(error);
      expect(client.getQueryData(queryKey)).toEqual(profile);
    } finally {
      client.clear();
    }
  });

  it('reports failures from student dashboard endpoints instead of empty results', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 429, headers: { 'Retry-After': '7' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      for (const request of [getNotifications, getUnreadCount, () => getNextLiveClass('s1')]) {
        await expect(request()).rejects.toMatchObject({ status: 429, retryAfterMs: 7_000 });
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
