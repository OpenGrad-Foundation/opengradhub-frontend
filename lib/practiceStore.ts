// IndexedDB-backed cache for client-side practice retakes. Stores the one-time
// practice payload per quiz, plus in-progress retake answers for refresh-resume.
// Nothing here is ever sent to the server.

export type PracticePayloadQuestion = {
  snapshot_id: string;
  order_index: number;
  section_id: string | null;
  question_type: string;
  content_html: string;
  options: { id: string; option_text: string; is_correct: boolean }[];
  correct_answer: string | null;
  tolerance: number | null;
  explanation_html: string | null;
  children: PracticePayloadQuestion[]; // nested GROUP children; [] for leaf questions
};

export type PracticePayload = {
  quiz_id: string;
  quiz_title: string;
  questions: PracticePayloadQuestion[];
};

export type PracticeAnswers = Record<string, string | null>;

const DB_NAME = 'opengrad-practice';
const DB_VERSION = 1;
const PAYLOADS = 'payloads';
const PROGRESS = 'progress';

// In-memory fallback used only when IndexedDB is entirely absent (SSR, very old
// browsers). A runtime IndexedDB failure instead degrades to a no-op write /
// null read — acceptable for a best-effort cache (the caller just re-fetches).
const memPayloads = new Map<string, PracticePayload>();
const memProgress = new Map<string, PracticeAnswers>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PAYLOADS)) db.createObjectStore(PAYLOADS);
      if (!db.objectStoreNames.contains(PROGRESS)) db.createObjectStore(PROGRESS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open connection'));
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = op(transaction.objectStore(store));
        let result: T;
        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error);
        };
      }),
  );
}

export async function savePayload(payload: PracticePayload): Promise<void> {
  if (!hasIndexedDb()) {
    memPayloads.set(payload.quiz_id, payload);
    return;
  }
  try {
    await tx(PAYLOADS, 'readwrite', (s) => s.put(payload, payload.quiz_id));
  } catch {
    // best-effort cache — ignore write failures
  }
}

export async function getPayload(quizId: string): Promise<PracticePayload | null> {
  if (!hasIndexedDb()) return memPayloads.get(quizId) ?? null;
  try {
    const result = await tx<PracticePayload | undefined>(PAYLOADS, 'readonly', (s) => s.get(quizId));
    return result ?? null;
  } catch {
    return null;
  }
}

export async function saveProgress(quizId: string, answers: PracticeAnswers): Promise<void> {
  if (!hasIndexedDb()) {
    memProgress.set(quizId, answers);
    return;
  }
  try {
    await tx(PROGRESS, 'readwrite', (s) => s.put(answers, quizId));
  } catch {
    // best-effort cache — ignore write failures
  }
}

export async function getProgress(quizId: string): Promise<PracticeAnswers | null> {
  if (!hasIndexedDb()) return memProgress.get(quizId) ?? null;
  try {
    const result = await tx<PracticeAnswers | undefined>(PROGRESS, 'readonly', (s) => s.get(quizId));
    return result ?? null;
  } catch {
    return null;
  }
}

export async function clearProgress(quizId: string): Promise<void> {
  if (!hasIndexedDb()) {
    memProgress.delete(quizId);
    return;
  }
  try {
    await tx(PROGRESS, 'readwrite', (s) => s.delete(quizId));
  } catch {
    // best-effort cache — ignore write failures
  }
}
