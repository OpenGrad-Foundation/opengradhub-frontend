// IndexedDB-backed draft store for in-progress quiz attempts.
// One record per attempt, keyed by attempt_id. Survives page refresh and
// tab close on the same browser. Cleared when the attempt is submitted.

const DB_NAME = 'opengrad-quiz';
const DB_VERSION = 1;
const STORE = 'drafts';

/** A saved snapshot of a student's in-progress answers for one attempt. */
export type QuizDraft = {
  attempt_id: string;
  answers: Record<string, string | null>;
  flagged: string[];
  current_idx: number;
  updated_at: number;
};

/** True when IndexedDB is usable (false during SSR / unsupported browsers). */
function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Opens (and lazily creates) the quiz draft database. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'attempt_id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Runs one request against the drafts store inside a single transaction. */
function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Persists the draft for one attempt, overwriting any previous draft. */
export async function saveDraft(draft: QuizDraft): Promise<void> {
  if (!hasIndexedDb()) return;
  await withStore('readwrite', (store) => store.put(draft));
}

/** Returns the saved draft for an attempt, or null if none exists. */
export async function loadDraft(attemptId: string): Promise<QuizDraft | null> {
  if (!hasIndexedDb()) return null;
  const result = await withStore<QuizDraft | undefined>('readonly', (store) =>
    store.get(attemptId),
  );
  return result ?? null;
}

/** Removes the draft for an attempt (called after submission). */
export async function clearDraft(attemptId: string): Promise<void> {
  if (!hasIndexedDb()) return;
  await withStore('readwrite', (store) => store.delete(attemptId));
}
