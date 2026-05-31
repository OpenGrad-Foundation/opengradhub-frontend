'use client';

import { useQueryClient } from '@tanstack/react-query';
import { clearPersistedQueryCache } from '@/lib/queries/persister';

export { useCurrentUser } from '@/lib/queries/current-user';

/**
 * Backwards-compat: callers (sign-out flow, role-change flows) used to call
 * clearUserCache() to nuke the sessionStorage entry. With L4, this also
 * wipes the in-memory QueryClient cache and the IDB-persisted query store
 * so the next user can't hydrate the previous user's data.
 *
 * Kept as a top-level function (NOT a hook) so it can be called from non-React
 * contexts. A queryClient is bound once at app mount via bindQueryClientForLegacy.
 */
let _qcRef: ReturnType<typeof useQueryClient> | null = null;

export function bindQueryClientForLegacy(qc: ReturnType<typeof useQueryClient>): void {
  _qcRef = qc;
}

export function clearUserCache(): void {
  if (_qcRef) {
    _qcRef.cancelQueries();
    _qcRef.clear();
  }
  void clearPersistedQueryCache();
  // Also clear the legacy sessionStorage entry to belt-and-suspenders cover
  // any stale write that may still exist from prior releases.
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('opengrad_user_v1');
  }
}
