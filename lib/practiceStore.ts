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

// In-memory fallback for environments without IndexedDB (private mode, SSR).
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
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = op(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function savePayload(payload: PracticePayload): Promise<void> {
  if (!hasIndexedDb()) {
    memPayloads.set(payload.quiz_id, payload);
    return;
  }
  await tx(PAYLOADS, 'readwrite', (s) => s.put(payload, payload.quiz_id));
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
  await tx(PROGRESS, 'readwrite', (s) => s.put(answers, quizId));
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
  await tx(PROGRESS, 'readwrite', (s) => s.delete(quizId));
}
