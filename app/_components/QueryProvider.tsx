'use client';

import { useState, type ReactNode, useEffect, useRef } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import { makeQueryClient } from '../../lib/queries/query-client';
import { bindQueryClientForLegacy } from '../../hooks/use-current-user';
import { clearPersistedQueryCache } from '../../lib/queries/persister';
import { clearApiAuth } from '../../lib/api';

/**
 * Binds the active QueryClient to the legacy `clearUserCache` helper so non-React
 * call sites (sign-out / role-change flows) can invalidate the current-user query.
 */
function LegacyClientBinder({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  useEffect(() => {
    bindQueryClientForLegacy(qc);
  }, [qc]);
  return <>{children}</>;
}

/**
 * Defence-in-depth against the IDB-persister leaking the previous user's
 * data into the next user's session. Watches Clerk's `userId` and wipes
 * every cache layer whenever the active identity changes — covers sidebar
 * sign-out, Clerk-hosted sign-in switches, browser back-button replays,
 * and any path that doesn't route through `handleSignOut`.
 */
function IdentityCacheGuard() {
  const { userId, isLoaded } = useAuth();
  const qc = useQueryClient();
  // `undefined` means "not yet observed" so the very first render after
  // Clerk hydration is treated as a baseline, not an identity change.
  const lastRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const current: string | null = userId ?? null;
    const last = lastRef.current;
    lastRef.current = current;
    if (last === undefined) return; // baseline; no wipe on initial mount
    if (last === current) return;
    // Identity changed (sign-in, sign-out, or user swap). Nuke every layer
    // that could hydrate the previous user's data.
    clearApiAuth();
    void qc.cancelQueries().then(() => {
      qc.clear();
      void clearPersistedQueryCache();
    });
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('opengrad_user_v1');
    }
  }, [userId, isLoaded, qc]);

  return null;
}

/**
 * Layer 4 of caching strategy v2 — wraps the app in a QueryClientProvider.
 *
 * The QueryClient is created once per mount via useState's initializer so a
 * re-render never throws away the cache. Mounted inside ClerkProvider in
 * app/layout.tsx so query hooks can read Clerk auth state.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <LegacyClientBinder>
        <IdentityCacheGuard />
        {children}
      </LegacyClientBinder>
    </QueryClientProvider>
  );
}
