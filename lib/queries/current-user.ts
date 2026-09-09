'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, setApiTokenGetter } from '@/lib/api';
import { isClerkMode, getStoredAuthToken } from '@/lib/auth-session';
import type { CurrentUserResponse } from '@/lib/types';

/** How long to wait for Clerk to bootstrap before surfacing an error instead. */
const CLERK_BOOT_TIMEOUT_MS = 10_000;

/**
 * Deliberately not "Please sign in" — the session may well be valid; what
 * failed is Clerk's own bootstrap, and retrying is the useful advice.
 */
const CLERK_BOOT_TIMEOUT_MESSAGE =
  'Could not reach the sign-in service. Check your connection and reload the page.';

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
export function useCurrentUser(): {
  data: CurrentUserResponse | null;
  error: string | null;
  isLoading: boolean;
} {
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

  useEffect(() => {
    if (clerkLoaded) {
      setBootTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setBootTimedOut(true), CLERK_BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [clerkLoaded]);

  const query = useQuery({
    queryKey: ['og', 'user', 'self', identityKey] as const,
    queryFn: async () => {
      let token: string | null = null;
      if (clerkMode) {
        try {
          token = await clerkAuth.getToken();
        } catch {
          token = null;
        }
      } else {
        token = getStoredAuthToken();
      }
      if (!token) {
        throw new Error('Please sign in to continue.');
      }
      return fetchCurrentUser(token);
    },
    staleTime: 30_000,
    gcTime: 60 * 60_000,
    enabled: clerkLoaded,
    refetchOnWindowFocus: true,
    // Identity is NEVER persisted to durable storage. Even with the userId-scoped
    // key above, persisting identity across sessions is the source of the
    // "sticky login" bug (a wipe that loses a race re-leaks the previous user).
    // It is resolved live each cold load from the token; the 30s staleTime +
    // server-side L3 Redis cache keep that cheap. Other (non-identity) queries
    // keep their IDB persister.
    retry: 1,
  });

  if (!clerkLoaded) {
    return {
      data: null,
      error: bootTimedOut ? CLERK_BOOT_TIMEOUT_MESSAGE : null,
      // A disabled query is `pending` but idle — report it as loading so the
      // caller shows a spinner instead of an error while Clerk boots.
      isLoading: !bootTimedOut,
    };
  }

  return {
    data: query.data ?? null,
    error: query.error ? (query.error as Error).message : null,
    isLoading: query.isPending,
  };
}
