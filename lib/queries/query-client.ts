import { QueryClient } from '@tanstack/react-query';

/**
 * Layer 4 of caching strategy v2 — QueryClient factory.
 *
 * Shared defaults:
 *  - staleTime 60s: a freshly-fetched query is reused without a refetch for a
 *    minute. Per-query hooks override this from the data-tier table.
 *  - refetchOnWindowFocus false: the userbase is on patchy mobile networks —
 *    a tab refocus must not trigger a wave of refetches.
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
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
