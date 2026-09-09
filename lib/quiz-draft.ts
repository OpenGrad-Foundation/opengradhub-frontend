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
  /**
   * Clerk user id of the student the draft belongs to. IndexedDB is scoped to
   * the browser origin, not the account — without this, a draft saved by one
   * account is offered for replay to whoever signs in next, and the server
   * rejects it forever ("does not belong to you"). Optional only for drafts
   * written before this field existed.
   */
  user_id?: string;
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

export type PendingSubmitsOptions = {
  /** Only return drafts owned by this user (drafts with no owner are legacy and always match). */
  userId?: string | null;
  /** Skip submits younger than this — theirs is likely still in flight in another tab. */
  minAgeMs?: number;
  /** Drafts pending longer than this are dead; they are dropped AND deleted. */
  maxAgeMs?: number;
};

/**
 * Returns every draft that has a pending submit payload — i.e. a submit/advance
 * POST was started but never confirmed cleared. Used by startup recovery to
 * offer replay of a quiz that may have been interrupted by a crash or network
 * drop.
 *
 * Two filters exist to stop the recovery prompt becoming immortal:
 *   - `userId` — a draft belonging to another account on this browser can never
 *     be replayed (the server rejects it), so it must not be offered.
 *   - `maxAgeMs` — a submit pending for that long will never be accepted again;
 *     the draft is pruned so it stops prompting on every launch. Only the
 *     current user's own drafts are pruned; another account's are left intact.
 */
export async function listPendingSubmits(opts: PendingSubmitsOptions = {}): Promise<QuizDraft[]> {
  if (!hasIndexedDb()) return [];
  const { userId = null, minAgeMs = 0, maxAgeMs = Infinity } = opts;
  const all = await withStore<QuizDraft[]>('readonly', (store) => store.getAll());
  const now = Date.now();
  const out: QuizDraft[] = [];
  for (const d of all ?? []) {
    if (d.submit_pending_at == null || !d.submit_payload) continue;
    // A draft with no owner predates user scoping — treat it as the current user's.
    if (d.user_id != null && d.user_id !== userId) continue;
    const age = now - d.submit_pending_at;
    if (age < minAgeMs) continue;
    if (age > maxAgeMs) {
      await clearDraft(d.attempt_id).catch(() => {});
      continue;
    }
    out.push(d);
  }
  return out;
}
