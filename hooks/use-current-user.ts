'use client';

import { useQueryClient } from '@tanstack/react-query';
import { clearPersistedQueryCache } from '@/lib/queries/persister';
import { clearApiAuth } from '@/lib/api';

export { useCurrentUser } from '@/lib/queries/current-user';

/**
 * Sign-out / role-change flows call this to nuke every layer that could
 * hydrate the previous user's identity:
 *   - in-memory QueryClient cache
 *   - in-flight queries (cancelled so they can't write back to IDB)
 *   - IDB-persisted query store (awaited — must complete before the next
 *     useCurrentUser mounts, otherwise the persister restores stale data)
 *   - api.ts auth token holders (so any refetch in the sign-out window
 *     can't resolve to the previous user's token)
 *   - legacy sessionStorage entry
 *
 * Returns a Promise — callers MUST await before navigating, or stale data
 * can leak into the next user's session.
 */
let _qcRef: ReturnType<typeof useQueryClient> | null = null;

export function bindQueryClientForLegacy(qc: ReturnType<typeof useQueryClient>): void {
  _qcRef = qc;
}

export async function clearUserCache(): Promise<void> {
  clearApiAuth();
  if (_qcRef) {
    await _qcRef.cancelQueries();
    _qcRef.clear();
  }
  await clearPersistedQueryCache();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('opengrad_user_v1');
  }
}
