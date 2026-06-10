import { openDB, type IDBPDatabase } from 'idb';
import { experimental_createQueryPersister } from '@tanstack/query-persist-client-core';

/**
 * Layer 4 of caching strategy v2 — IndexedDB persistence for TanStack Query.
 *
 * Uses the per-query persister API (not the monolithic persistQueryClient) so
 * each query restores independently and a single mutation never rewrites the
 * whole cache.
 *
 * NOTE — deviation from the Task 3 plan: the plan referenced
 * `experimental_createPersister` from `@tanstack/react-query`. In the installed
 * v5.100.11, the per-query persister is NOT exported by `@tanstack/react-query`
 * (nor `@tanstack/query-core`). It lives in the sibling package
 * `@tanstack/query-persist-client-core` and is named
 * `experimental_createQueryPersister`. That version-pinned package was added.
 *
 * The buster is keyed on APP_VERSION: a deploy bumps the version, which makes
 * TanStack discard every persisted entry whose buster differs — so a change
 * in query shape across a release can never hydrate stale data.
 */

const DB_NAME = 'og-query-cache';
const STORE = 'queries';

/**
 * Cache buster. Bumped per release. NEXT_PUBLIC_APP_VERSION is injected at
 * build time; falls back to a constant for local dev.
 */
export const APP_VERSION: string =
  process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

let _dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE);
        }
      },
    });
  }
  return _dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return (await db()).get(STORE, key) as Promise<T | undefined>;
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  await (await db()).put(STORE, value, key);
}

export async function idbDel(key: string): Promise<void> {
  await (await db()).delete(STORE, key);
}

/**
 * Wipes every persisted query entry. Called on sign-out / role-change so the
 * next user can't hydrate the previous user's data from IDB.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  await (await db()).clear(STORE);
}

/**
 * Build a per-query persister bound to the IDB store. Returns the
 * `persisterFn` function directly so it can be passed to a useQuery's
 * `persister` option without further unwrapping. Queries that should NOT be
 * persisted (Tier 2) simply omit this.
 */
export function makeIdbPersister() {
  const p = experimental_createQueryPersister({
    storage: {
      getItem: (key: string) => idbGet<string>(key),
      setItem: (key: string, value: string) => idbSet(key, value),
      removeItem: (key: string) => idbDel(key),
    },
    // Entries older than 2h are treated as expired on restore. Bounds how
    // stale a cold page load (browser restart, hydrating from IDB) can be:
    // beyond this the persisted copy is discarded and the query refetches.
    // Was 24h, which could surface day-old reference data on first paint.
    maxAge: 1000 * 60 * 60 * 2,
    buster: APP_VERSION,
  });
  return p.persisterFn;
}
