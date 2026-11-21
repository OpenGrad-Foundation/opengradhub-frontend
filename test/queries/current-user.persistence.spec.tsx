import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * Regression guard for the "sticky login" bug: the current-user (identity)
 * query MUST NOT be persisted to durable IndexedDB. Persisting identity under
 * the constant key ['og','user','self'] let the previous user's identity
 * survive sign-out and hydrate into the next user's session.
 *
 * We mock useQuery to capture the options the hook passes, then assert no
 * `persister` is configured.
 *
 * Lives in a .tsx file so it runs under the jsdom project — the hook uses real
 * React state for the Clerk bootstrap timeout and cannot be called bare.
 */

let capturedOptions: Record<string, unknown> | undefined;

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => {
    capturedOptions = options;
    return { data: undefined, error: null, isPending: true };
  },
}));

let clerkAuth: {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
};

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => clerkAuth,
}));

import { useCurrentUser } from '@/lib/queries/current-user';
import { ApiError, clearApiAuth } from '@/lib/api';

function getCapturedQueryFn() {
  const entry = {};
  const context = {
    client: { getQueryCache: () => ({ find: () => entry }) },
    queryKey: capturedOptions!.queryKey,
  };
  const queryFn = capturedOptions!.queryFn as (context: unknown) => Promise<unknown>;
  return () => queryFn(context);
}

describe('useCurrentUser query configuration', () => {
  beforeEach(() => {
    capturedOptions = undefined;
    clerkAuth = {
      getToken: async () => 'test-token',
      isLoaded: true,
      isSignedIn: true,
      userId: 'user_abc',
    };
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    clearApiAuth();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does NOT persist the identity query to durable storage', () => {
    renderHook(() => useCurrentUser());
    expect(capturedOptions).toBeDefined();
    // The fix: identity is resolved live each cold load, never restored from IDB.
    expect(capturedOptions!.persister).toBeUndefined();
  });

  it('scopes the query key by identity so it can never be shared across users', () => {
    renderHook(() => useCurrentUser());
    const key = capturedOptions!.queryKey as unknown[];
    // Must carry a 4th identity segment beyond the constant ['og','user','self'].
    expect(key.slice(0, 3)).toEqual(['og', 'user', 'self']);
    expect(key.length).toBeGreaterThan(3);
    expect(key[3]).toBeTruthy();
  });

  it('keys by the Clerk user id in Clerk mode', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    renderHook(() => useCurrentUser());
    expect((capturedOptions!.queryKey as unknown[])[3]).toBe('user_abc');
  });

  it('holds the query disabled while Clerk is still bootstrapping', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    clerkAuth = { ...clerkAuth, isLoaded: false, isSignedIn: false, userId: null };

    const { result } = renderHook(() => useCurrentUser());

    // Before isLoaded flips, getToken() always resolves null — running the
    // query would surface a bogus "Please sign in to continue." error.
    expect(capturedOptions!.enabled).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('leaves a known signed-out session to the route middleware on reload', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    clerkAuth = { ...clerkAuth, isLoaded: true, isSignedIn: false, userId: null };

    const { result } = renderHook(() => useCurrentUser());
    expect(capturedOptions!.enabled).toBe(false);
    expect(result.current.errorKind).toBe('signed-out');
    expect(result.current.isLoading).toBe(false);
  });

  it('reports a bootstrap failure rather than spinning forever', () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    clerkAuth = { ...clerkAuth, isLoaded: false, isSignedIn: false, userId: null };

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // A terminal state, and NOT "Please sign in" — the session may be fine;
    // it is Clerk's own bootstrap that failed.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toMatch(/could not reach the sign-in service/i);
    expect(result.current.error).not.toMatch(/sign in to continue/i);
    // The query must stay disabled: getToken() on an unloaded Clerk always
    // returns null and would report a bogus signed-out error.
    expect(capturedOptions!.enabled).toBe(false);
  });

  it('clears the bootstrap timeout once Clerk loads', () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    clerkAuth = { ...clerkAuth, isLoaded: false, isSignedIn: false, userId: null };

    const { result, rerender } = renderHook(() => useCurrentUser());
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.error).toBeTruthy();

    clerkAuth = { ...clerkAuth, isLoaded: true, isSignedIn: true, userId: 'user_abc' };
    act(() => {
      rerender();
    });

    expect(result.current.error).toBeNull();
    expect(capturedOptions!.enabled).toBe(true);

    // isLoaded can revert during an auth update — a stale timed-out flag would
    // let that second bootstrap skip the gate.
    clerkAuth = { ...clerkAuth, isLoaded: false, isSignedIn: false, userId: null };
    act(() => {
      rerender();
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not leave a pending timer behind on unmount', () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    clerkAuth = { ...clerkAuth, isLoaded: false, isSignedIn: false, userId: null };

    const { unmount } = renderHook(() => useCurrentUser());
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('fetches once with a fresh Clerk token after a 401 and then surfaces a second 401', async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    const getToken = vi.fn().mockResolvedValueOnce('old-token').mockResolvedValueOnce('fresh-token');
    clerkAuth.getToken = getToken;
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useCurrentUser());

    const queryFn = getCapturedQueryFn();
    const retry = capturedOptions!.retry as (count: number, error: Error) => boolean;
    await expect(queryFn()).rejects.toMatchObject({ status: 401 });
    expect(getToken.mock.calls).toEqual([[{ skipCache: false }], [{ skipCache: true }]]);
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringMatching(/\/users\/me$/), {
      headers: { Authorization: 'Bearer fresh-token' },
    });
    expect(retry(0, new ApiError('Unauthorized', 401))).toBe(false);
  });

  it('treats Clerk token exceptions on signed-in sessions as transient', async () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    const tokenError = new Error('Please sign in');
    clerkAuth.getToken = vi.fn().mockRejectedValue(tokenError);
    renderHook(() => useCurrentUser());

    const queryFn = getCapturedQueryFn();
    const retry = capturedOptions!.retry as (count: number, error: Error) => boolean;
    await expect(queryFn()).rejects.toMatchObject({
      message: 'Could not reach the sign-in service. Please try again.',
      cause: tokenError,
    });
    expect(retry(0, tokenError)).toBe(true);
    expect(retry(1, tokenError)).toBe(true);
    expect(retry(2, tokenError)).toBe(false);
  });

  it('defers a focus refetch until the profile cooldown expires', () => {
    vi.useFakeTimers();
    renderHook(() => useCurrentUser());
    const onFocus = capturedOptions!.refetchOnWindowFocus as (query: { state: { error: Error } }) => boolean;
    const error = new ApiError('Busy', new Response(null, { status: 429, headers: { 'Retry-After': '12' } }));
    expect(onFocus({ state: { error } })).toBe(false);
    vi.advanceTimersByTime(12_000);
    expect(onFocus({ state: { error } })).toBe(true);
  });

  it('skips network requests when an invalidation restarts a rate-limited fetch', async () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    const fetchMock = vi.fn(async () => new Response(null, { status: 429, headers: { 'Retry-After': '12' } }));
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useCurrentUser());
    const queryFn = getCapturedQueryFn();

    await expect(queryFn()).rejects.toMatchObject({ status: 429, retryAfterMs: 12_000 });
    vi.advanceTimersByTime(11_999);
    await expect(queryFn()).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1);
    await expect(queryFn()).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
