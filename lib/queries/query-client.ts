import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api';
import { PERSISTER_KEY_PREFIX } from '@tanstack/query-persist-client-core';
import { idbDel } from './persister';

/**
 * Layer 4 of caching strategy v2 — QueryClient factory.
 *
 * Shared defaults:
 *  - staleTime 60s: a freshly-fetched query is reused without a refetch for a
 *    minute. Per-query hooks override this from the data-tier table.
 *  - refetchOnWindowFocus false (default): a tab refocus does NOT refetch. This
 *    was previously true, which caused 10-18 refetches per focus on dense pages
 *    (tracker mounts ~18 hooks) × every user all day — a dominant, user-count-
 *    independent load. Freshness for live data comes from the SSE stream
 *    (useRealtime), which invalidates the affected keys on a server change.
 *    Queries that genuinely need focus-refresh (e.g. current-user identity/role)
 *    opt back in per-hook with `refetchOnWindowFocus: true`.
 *  - retry 1: a down backend fails fast instead of hammering it 3x.
 *
 * A fresh client is created per browser session (or per server request in
 * the unlikely event this runs server-side) — never a module-level singleton.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // TanStack keeps prior data after a failed refetch. A revoked response
        // must disappear immediately while the access error stays visible.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          query.setState({ data: undefined, dataUpdatedAt: 0 });
          if (typeof indexedDB !== 'undefined') {
            void idbDel(`${PERSISTER_KEY_PREFIX}-${query.queryHash}`).catch(() => undefined);
          }
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
