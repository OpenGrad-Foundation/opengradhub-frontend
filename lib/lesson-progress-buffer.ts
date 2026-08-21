/**
 * Local buffer for video watch progress.
 *
 * The lesson player used to PATCH /lesson-progress every 5 seconds, which made
 * it far and away the busiest write in the system — and most of those writes
 * were no-ops, because `watched_percent` is a rounded integer and the server
 * upsert takes GREATEST(existing, incoming).
 *
 * Now the 5s poll only moves local state (it still drives the progress bar) and
 * stages the value here. The network flush happens on meaningful events only —
 * completion, video end, tab hide, unload, unmount, and a slow safety tick.
 *
 * Every staged value is mirrored into localStorage so a browser crash, an OS
 * kill or an offline flush doesn't lose the watch. Pending entries are replayed
 * when the student next opens a lesson. Replay is safe by construction: the
 * server upsert only ever raises watched_percent and only ever latches
 * is_complete on, so a stale replay cannot regress a row.
 */

import {
  patchLessonProgress,
  flushLessonProgressOnUnload,
  type LessonProgressPayload,
} from "@/lib/api";

/** Flush at most this often while a video is playing (crash insurance). */
export const SAFETY_FLUSH_MS = 120_000;

/** Server marks a lesson complete at this percentage. Must flush immediately. */
export const COMPLETION_PCT = 80;

/** Drop buffered entries older than this — a student who never came back. */
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Never let a shared browser accumulate unbounded buffered progress. */
const MAX_PENDING_ENTRIES = 50;

const KEY_PREFIX = "og:lp:";

export type PendingProgress = LessonProgressPayload & { staged_at: number };

/**
 * Keyed by student AND lesson. Without the student id, a re-login on a shared
 * browser would replay one student's buffered progress under another's token —
 * the server derives student_id from the JWT, so it would land on the wrong row.
 */
function pendingKey(studentId: string, lessonId: string): string {
  return `${KEY_PREFIX}${studentId}:${lessonId}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null; // Safari private mode, blocked storage
  }
}

/** Persist the latest known progress for a lesson, replacing any earlier value. */
export function stagePending(payload: LessonProgressPayload): void {
  const store = storage();
  if (!store) return;
  const entry: PendingProgress = { ...payload, staged_at: Date.now() };
  try {
    store.setItem(pendingKey(payload.student_id, payload.lesson_id), JSON.stringify(entry));
  } catch {
    // Quota exceeded — evict what we can and give up quietly rather than
    // breaking playback over a progress bar.
    purgeExpired();
  }
}

export function clearPending(studentId: string, lessonId: string): void {
  try {
    storage()?.removeItem(pendingKey(studentId, lessonId));
  } catch {
    /* ignore */
  }
}

function readAllKeys(): string[] {
  const store = storage();
  if (!store) return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(KEY_PREFIX)) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

function readEntry(key: string): PendingProgress | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingProgress;
    if (
      typeof parsed?.lesson_id !== "string" ||
      typeof parsed?.student_id !== "string" ||
      typeof parsed?.watched_percent !== "number"
    ) {
      store.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try { store.removeItem(key); } catch { /* ignore */ }
    return null;
  }
}

/** Evict entries past their TTL, then trim the oldest if still over the cap. */
export function purgeExpired(): void {
  const store = storage();
  if (!store) return;
  const now = Date.now();
  const live: { key: string; staged_at: number }[] = [];

  for (const key of readAllKeys()) {
    const entry = readEntry(key);
    if (!entry) continue;
    if (now - (entry.staged_at ?? 0) > PENDING_TTL_MS) {
      try { store.removeItem(key); } catch { /* ignore */ }
      continue;
    }
    live.push({ key, staged_at: entry.staged_at ?? 0 });
  }

  if (live.length <= MAX_PENDING_ENTRIES) return;
  live
    .sort((a, b) => a.staged_at - b.staged_at)
    .slice(0, live.length - MAX_PENDING_ENTRIES)
    .forEach(({ key }) => {
      try { store.removeItem(key); } catch { /* ignore */ }
    });
}

/**
 * Send every buffered entry belonging to `studentId`, clearing each on success.
 *
 * Deliberately scoped to one student: entries left by a different account on a
 * shared device are NOT replayed here (the server would attribute them to the
 * current caller). They stay put until that student signs back in, or until the
 * TTL purge collects them.
 */
export async function replayPending(studentId: string): Promise<void> {
  purgeExpired();
  const prefix = `${KEY_PREFIX}${studentId}:`;
  const mine = readAllKeys().filter((key) => key.startsWith(prefix));

  await Promise.all(
    mine.map(async (key) => {
      const entry = readEntry(key);
      if (!entry) return;
      const { staged_at: _stagedAt, ...payload } = entry;
      try {
        await patchLessonProgress(payload);
        clearPending(entry.student_id, entry.lesson_id);
      } catch {
        // Still offline or still 401 — leave it queued for the next attempt.
      }
    }),
  );
}

/** Flush one entry over the network, clearing the local copy on success. */
export async function flushPending(payload: LessonProgressPayload): Promise<
  { is_complete: boolean } | null
> {
  stagePending(payload);
  try {
    const result = await patchLessonProgress(payload);
    clearPending(payload.student_id, payload.lesson_id);
    return result;
  } catch {
    return null;
  }
}

/**
 * Flush during page teardown. Fire-and-forget: `keepalive` gives the request a
 * chance to outlive the document, and the staged copy covers the case where it
 * doesn't. The local entry is deliberately NOT cleared — we never learn whether
 * this landed, and a duplicate replay is harmless.
 */
export function flushPendingOnUnload(payload: LessonProgressPayload): void {
  stagePending(payload);
  flushLessonProgressOnUnload(payload);
}
