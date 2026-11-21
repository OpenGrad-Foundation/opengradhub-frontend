'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { ApiError, fetchCurrentUser, setApiTokenGetter } from '@/lib/api';
import { isClerkMode, getStoredAuthToken } from '@/lib/auth-session';
import { automaticRetryAt, canRetryQuery, queryRetryDelay, retryAfterAt } from './retry';

/** How long to wait for Clerk to bootstrap before surfacing an error instead. */
const CLERK_BOOT_TIMEOUT_MS = 10_000;
// An invalidation can start a new fetch and reset the retryer while cached data exists.
// Keep the server's deadline on the same user-scoped query across those fetches.
const profileCooldowns = new WeakMap<object, ApiError>();

/**
 * Deliberately not "Please sign in" — the session may well be valid; what
 * failed is Clerk's own bootstrap, and retrying is the useful advice.
 */
const CLERK_BOOT_TIMEOUT_MESSAGE =
  'Could not reach the sign-in service. Check your connection and reload the page.';

function profileErrorKind(error: Error | null | undefined) {
  if (!error) return null;
  if (!(error instanceof ApiError)) return 'transient';
  switch (error.status) {
    case 401: return 'session';
    case 403: return 'forbidden';
    case 404: return 'not-provisioned';
    case 0:
    case 429: return 'transient';
    default: return error.status >= 500 ? 'transient' : 'other';
  }
}

function canRefetchProfile(query: { state: { error: Error | null } }) {
  const kind = profileErrorKind(query.state.error);
  return (kind === null || kind === 'transient') && (retryAfterAt(query.state.error) ?? 0) <= Date.now();
}

/**
 * Layer 4 — production-grade per-user current-user hook.
 *
 * Returns the legacy `{ data, error, isLoading }` shape so existing imports of
 * `useCurrentUser` from `@/hooks/use-current-user` work unchanged. Underneath
 * it uses TanStack Query so:
 *   - server-side L3 cache (`og:user:{userId}`) does the heavy lifting (30 s TTL).
 *   - client-side dedup of concurrent callers.
 *   - IDB persistence so repeat page loads paint immediately.
 *   - `refetchOnWindowFocus: true` (overriding the global default) so a tab
 *     refocus triggers a revalidation — surfaces role/permission changes
 *     applied by an admin while the user was on another tab.
 *
 * staleTime is 30 s to align with the server-side cache TTL.
 */
export function useCurrentUser() {
  const clerkAuth = useAuth();
  const clerkMode = isClerkMode();

  // Register the Clerk token getter on every render so apiFetch always sees a
  // fresh token. Cheap — Clerk caches internally.
  if (clerkMode) {
    setApiTokenGetter(() => clerkAuth.getToken());
  }

  // Scope the query key by Clerk user id so the IDB-persisted entry for user A
  // can never hydrate user B — different key, no restoration. `clerkAuth.userId`
  // is `null` before Clerk loads and in custom-auth mode (where the legacy
  // token store identifies the caller instead).
  const identityKey: string = clerkMode ? clerkAuth.userId ?? 'anon' : 'local';

  // Clerk resolves its session asynchronously. Until `isLoaded` flips,
  // `getToken()` resolves to null, which would surface as a hard
  // "Please sign in to continue." error on a perfectly valid session.
  // Keep the query disabled (and the hook in its loading state) until Clerk
  // has settled.
  //
  // `bootTimedOut` bounds that wait: if Clerk's bootstrap never completes
  // (its script blocked, FAPI unreachable) `isLoaded` never flips, and gating
  // on it alone would leave the dashboard on a spinner forever. After the
  // grace period we surface a bootstrap error instead of spinning.
  //
  // The query stays DISABLED in that state: `getToken()` on an unloaded Clerk
  // always resolves null, so running it would report "Please sign in to
  // continue." for what may be a perfectly valid but slow session. Say what
  // actually went wrong instead.
  //
  // The flag resets whenever Clerk loads — `isLoaded` can revert to false
  // during an auth update, and a stale `true` here would let that second
  // bootstrap skip the gate entirely.
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const clerkLoaded = !clerkMode || clerkAuth.isLoaded;
  const clerkSignedOut = clerkMode && clerkAuth.isLoaded && clerkAuth.isSignedIn === false;

  useEffect(() => {
    if (clerkLoaded) {
      setBootTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setBootTimedOut(true), CLERK_BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [clerkLoaded]);

  async function getClerkToken(skipCache = false) {
    // A token could not be obtained even though Clerk has an active session.
    // Let query retry handle the exception or empty response as a transient failure.
    let token: string | null;
    try {
      token = await clerkAuth.getToken({ skipCache });
    } catch (cause) {
      throw new Error('Could not reach the sign-in service. Please try again.', { cause });
    }
    if (!token) throw new Error('Could not get a token from the sign-in service.');
    return token;
  }

  async function loadProfile() {
    if (!clerkMode) {
      const token = getStoredAuthToken();
      if (!token) throw new ApiError('Please sign in to continue.', 401);
      return fetchCurrentUser(token);
    }
    const token = await getClerkToken();
    try {
      return await fetchCurrentUser(token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      return fetchCurrentUser(await getClerkToken(true));
    }
  }

  const query = useQuery({
    queryKey: ['og', 'user', 'self', identityKey] as const,
    queryFn: async ({ client, queryKey }) => {
      const entry = client.getQueryCache().find({ queryKey });
      const cooldown = entry && profileCooldowns.get(entry);
      if (cooldown && (cooldown.retryAfterAt ?? 0) > Date.now()) throw cooldown;

      try {
        return await loadProfile();
      } catch (error) {
        if (entry && error instanceof ApiError && error.retryAfterAt !== undefined) {
          profileCooldowns.set(entry, error);
        }
        throw error;
      }
    },
    staleTime: 30_000,
    gcTime: 60 * 60_000,
    enabled: clerkLoaded && !clerkSignedOut,
    refetchOnWindowFocus: canRefetchProfile,
    refetchOnReconnect: canRefetchProfile,
    refetchOnMount: canRefetchProfile,
    retryOnMount: false,
    // Identity is NEVER persisted to durable storage. Even with the userId-scoped
    // key above, persisting identity across sessions is the source of the
    // "sticky login" bug (a wipe that loses a race re-leaks the previous user).
    // It is resolved live each cold load from the token; the 30s staleTime +
    // server-side L3 Redis cache keep that cheap. Other (non-identity) queries
    // keep their IDB persister.
    retry: (failureCount, error) => canRetryQuery(failureCount, error, 2),
    retryDelay: queryRetryDelay,
  });

  function retry() {
    if (!clerkLoaded || clerkSignedOut) {
      window.location.reload();
    } else if ((retryAfterAt(query.failureReason ?? query.error) ?? 0) <= Date.now()) {
      void query.refetch({ cancelRefetch: false });
    }
  }

  if (!clerkLoaded || clerkSignedOut) {
    return {
      data: null,
      error: clerkSignedOut ? 'Your session has ended. Reload to continue.' : bootTimedOut ? CLERK_BOOT_TIMEOUT_MESSAGE : null,
      errorKind: clerkSignedOut ? 'signed-out' as const : bootTimedOut ? 'bootstrap' as const : null,
      errorStatus: null,
      retryAt: undefined,
      isFetching: false,
      retry,
      // A disabled query is `pending` but idle — report it as loading so the
      // caller shows a spinner instead of an error while Clerk boots.
      isLoading: !clerkSignedOut && !bootTimedOut,
    };
  }

  const error = query.failureReason ?? query.error;
  return {
    data: query.data ?? null,
    error: error?.message ?? null,
    errorKind: profileErrorKind(error),
    errorStatus: error instanceof ApiError ? error.status : null,
    retryAt: query.isFetching ? automaticRetryAt(query.failureReason) : retryAfterAt(error),
    isFetching: query.isFetching,
    isLoading: query.isPending,
    retry,
  };
}
