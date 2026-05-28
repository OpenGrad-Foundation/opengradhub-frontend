// IndexedDB-backed draft store for in-progress quiz attempts.
// One record per attempt, keyed by attempt_id. Survives page refresh and
// tab close on the same browser. Cleared when the attempt is submitted.

const DB_NAME = 'opengrad-quiz';
const DB_VERSION = 1;
const STORE = 'drafts';

/** One answer entry in a submit payload. Mirrors the api submit/advance shape. */
export type DraftAnswer = {
  snapshot_id: string;
  student_answer: string | null;
  time_taken_seconds?: number | null;
};

/** A saved snapshot of a student's in-progress answers for one attempt. */
export type QuizDraft = {
  attempt_id: string;
  answers: Record<string, string | null>;
  flagged: string[];
  current_idx: number;
  updated_at: number;
  /** Phase 3: the active section id for sectioned (non-sequential) attempts.
   *  Sequential mode uses server-side current_section_index instead. */
  section_state?: { current_section_id?: string };
  /**
   * Submit-durability fields. Set just before a submit/advance POST so a
   * crash mid-submit can be recovered on next launch. `submit_payload` is the
   * exact request body — replay must NOT rebuild it from in-memory state,
   * which is gone after a browser close. Cleared on submit success.
   */
  submit_pending_at?: number;
  quiz_id?: string;
  submit_payload?: DraftAnswer[];
  /** Which endpoint to replay: full attempt submit vs. final section advance. */
  submit_kind?: 'full' | 'section';
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
        req.onerror = (event) => {
          // Stop the error event bubbling to window (avoids duplicate reports).
          event.preventDefault();
          db.close();
          reject(req.error);
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
        };
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

/**
 * Returns every draft that has a pending submit payload — i.e. a submit/advance
 * POST was started but never confirmed cleared. Used by startup recovery to
 * offer replay of a quiz that may have been interrupted by a crash or network
 * drop. `olderThanMs` skips drafts whose submit is likely still in flight in
 * another tab.
 */
export async function listPendingSubmits(olderThanMs = 0): Promise<QuizDraft[]> {
  if (!hasIndexedDb()) return [];
  const all = await withStore<QuizDraft[]>('readonly', (store) => store.getAll());
  const cutoff = Date.now() - olderThanMs;
  return (all ?? []).filter(
    (d) => d.submit_pending_at != null && d.submit_pending_at <= cutoff && !!d.submit_payload,
  );
}
