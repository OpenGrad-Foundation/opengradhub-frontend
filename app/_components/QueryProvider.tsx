'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '../../lib/queries/query-client';

/**
 * Layer 4 of caching strategy v2 — wraps the app in a QueryClientProvider.
 *
 * The QueryClient is created once per mount via useState's initializer so a
 * re-render never throws away the cache. Mounted inside ClerkProvider in
 * app/layout.tsx so query hooks can read Clerk auth state.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
