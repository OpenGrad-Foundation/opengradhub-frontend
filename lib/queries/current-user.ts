'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { fetchCurrentUser, setApiTokenGetter } from '@/lib/api';
import { isClerkMode, getStoredAuthToken } from '@/lib/auth-session';
import type { CurrentUserResponse } from '@/lib/types';
import { makeIdbPersister } from './persister';

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

  const query = useQuery({
    queryKey: ['og', 'user', 'self'] as const,
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
    refetchOnWindowFocus: true,
    persister: makeIdbPersister(),
    retry: 1,
  });

  return {
    data: query.data ?? null,
    error: query.error ? (query.error as Error).message : null,
    isLoading: query.isPending,
  };
}
