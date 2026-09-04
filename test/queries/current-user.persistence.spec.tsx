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

  it('runs the query once Clerk has loaded, even when signed out', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    clerkAuth = { ...clerkAuth, isLoaded: true, isSignedIn: false, userId: null };

    renderHook(() => useCurrentUser());

    // A genuine signed-out state must still reach the error path.
    expect(capturedOptions!.enabled).toBe(true);
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
});
