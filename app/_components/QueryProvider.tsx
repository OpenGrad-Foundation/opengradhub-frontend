'use client';

import { useState, type ReactNode, useEffect } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { makeQueryClient } from '../../lib/queries/query-client';
import { bindQueryClientForLegacy } from '../../hooks/use-current-user';

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
      <LegacyClientBinder>{children}</LegacyClientBinder>
    </QueryClientProvider>
  );
}
