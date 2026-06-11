import { QueryClient } from '@tanstack/react-query';

/**
 * Layer 4 of caching strategy v2 — QueryClient factory.
 *
 * Shared defaults:
 *  - staleTime 60s: a freshly-fetched query is reused without a refetch for a
 *    minute. Per-query hooks override this from the data-tier table.
 *  - refetchOnWindowFocus true: a tab refocus refetches, BUT only queries that
 *    are already past their staleTime — TanStack gates focus-refetch on
 *    staleness. So fresh data (within its staleTime) is still served from cache
 *    on a patchy mobile network; only genuinely-stale data triggers a request.
 *    This is the cure for "I switched tabs/apps and the data was old": external
 *    changes (made by other users) now surface on return instead of waiting out
 *    the full staleTime with no trigger.
 *  - retry 1: a down backend fails fast instead of hammering it 3x.
 *
 * A fresh client is created per browser session (or per server request in
 * the unlikely event this runs server-side) — never a module-level singleton.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}
