import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression guard for the "sticky login" bug: the current-user (identity)
 * query MUST NOT be persisted to durable IndexedDB. Persisting identity under
 * the constant key ['og','user','self'] let the previous user's identity
 * survive sign-out and hydrate into the next user's session.
 *
 * We mock useQuery to capture the options the hook passes, then assert no
 * `persister` is configured.
 */

let capturedOptions: Record<string, unknown> | undefined;

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => {
    capturedOptions = options;
    return { data: undefined, error: null, isPending: true };
  },
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: async () => 'test-token' }),
}));

import { useCurrentUser } from '@/lib/queries/current-user';

describe('useCurrentUser query configuration', () => {
  beforeEach(() => {
    capturedOptions = undefined;
  });

  it('does NOT persist the identity query to durable storage', () => {
    useCurrentUser();
    expect(capturedOptions).toBeDefined();
    // The fix: identity is resolved live each cold load, never restored from IDB.
    expect(capturedOptions!.persister).toBeUndefined();
  });

  it('scopes the query key by identity so it can never be shared across users', () => {
    useCurrentUser();
    const key = capturedOptions!.queryKey as unknown[];
    // Must carry a 4th identity segment beyond the constant ['og','user','self'].
    expect(key.slice(0, 3)).toEqual(['og', 'user', 'self']);
    expect(key.length).toBeGreaterThan(3);
    expect(key[3]).toBeTruthy();
  });
});
