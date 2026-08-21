/**
 * .spec.tsx so vitest runs this under the jsdom project — the buffer is built
 * on localStorage, which the node project does not provide. (Extension picks
 * the environment in vitest.config.ts.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const patchLessonProgress = vi.fn();
const flushLessonProgressOnUnload = vi.fn();

vi.mock("@/lib/api", () => ({
  patchLessonProgress: (...args: unknown[]) => patchLessonProgress(...args),
  flushLessonProgressOnUnload: (...args: unknown[]) => flushLessonProgressOnUnload(...args),
}));

import {
  stagePending,
  clearPending,
  purgeExpired,
  replayPending,
  flushPending,
  flushPendingOnUnload,
} from "@/lib/lesson-progress-buffer";

const ALICE = "alice-id";
const BOB = "bob-id";
const LESSON = "lesson-1";

function entry(studentId: string, lessonId: string, pct: number) {
  return { student_id: studentId, lesson_id: lessonId, watched_percent: pct };
}

function keysInStore(): string[] {
  return Object.keys(window.localStorage).filter((k) => k.startsWith("og:lp:"));
}

describe("lesson progress buffer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    patchLessonProgress.mockReset();
    flushLessonProgressOnUnload.mockReset();
    patchLessonProgress.mockResolvedValue({ id: "lp", is_complete: false, watched_percent: 50 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stages and clears an entry keyed by student and lesson", () => {
    stagePending(entry(ALICE, LESSON, 50));
    expect(keysInStore()).toEqual([`og:lp:${ALICE}:${LESSON}`]);

    clearPending(ALICE, LESSON);
    expect(keysInStore()).toEqual([]);
  });

  it("keeps one entry per lesson, overwriting the older percentage", () => {
    stagePending(entry(ALICE, LESSON, 20));
    stagePending(entry(ALICE, LESSON, 65));

    expect(keysInStore()).toHaveLength(1);
    const stored = JSON.parse(window.localStorage.getItem(`og:lp:${ALICE}:${LESSON}`)!);
    expect(stored.watched_percent).toBe(65);
  });

  it("never replays another student's buffered progress", async () => {
    // The server derives student_id from the JWT, so replaying Bob's entry while
    // Alice is signed in would write Bob's percentage onto Alice's row.
    stagePending(entry(BOB, "lesson-bob", 90));
    stagePending(entry(ALICE, LESSON, 30));

    await replayPending(ALICE);

    expect(patchLessonProgress).toHaveBeenCalledTimes(1);
    expect(patchLessonProgress).toHaveBeenCalledWith(
      expect.objectContaining({ student_id: ALICE, lesson_id: LESSON }),
    );
    // Bob's entry survives, waiting for Bob to sign back in.
    expect(keysInStore()).toContain(`og:lp:${BOB}:lesson-bob`);
  });

  it("clears a replayed entry once the server accepts it", async () => {
    stagePending(entry(ALICE, LESSON, 30));

    await replayPending(ALICE);

    expect(keysInStore()).toEqual([]);
  });

  it("keeps the entry queued when replay fails", async () => {
    patchLessonProgress.mockRejectedValue(new Error("offline"));
    stagePending(entry(ALICE, LESSON, 30));

    await replayPending(ALICE);

    expect(keysInStore()).toEqual([`og:lp:${ALICE}:${LESSON}`]);
  });

  it("drops entries past the 7-day TTL", () => {
    stagePending(entry(ALICE, LESSON, 30));
    const key = `og:lp:${ALICE}:${LESSON}`;
    const stale = JSON.parse(window.localStorage.getItem(key)!);
    stale.staged_at = Date.now() - 8 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(key, JSON.stringify(stale));

    purgeExpired();

    expect(keysInStore()).toEqual([]);
  });

  it("discards corrupt entries instead of replaying them", async () => {
    window.localStorage.setItem(`og:lp:${ALICE}:${LESSON}`, "{not json");

    await replayPending(ALICE);

    expect(patchLessonProgress).not.toHaveBeenCalled();
    expect(keysInStore()).toEqual([]);
  });

  describe("flushPending", () => {
    it("clears the local copy on success", async () => {
      const result = await flushPending(entry(ALICE, LESSON, 55));

      expect(result).toEqual({ id: "lp", is_complete: false, watched_percent: 50 });
      expect(keysInStore()).toEqual([]);
    });

    it("returns null and retains the entry on failure", async () => {
      patchLessonProgress.mockRejectedValue(new Error("500"));

      const result = await flushPending(entry(ALICE, LESSON, 55));

      expect(result).toBeNull();
      expect(keysInStore()).toEqual([`og:lp:${ALICE}:${LESSON}`]);
    });
  });

  it("retains the local copy after an unload flush, since delivery is unknowable", () => {
    flushPendingOnUnload(entry(ALICE, LESSON, 77));

    expect(flushLessonProgressOnUnload).toHaveBeenCalledWith(
      expect.objectContaining({ watched_percent: 77 }),
    );
    expect(keysInStore()).toEqual([`og:lp:${ALICE}:${LESSON}`]);
  });
});
