import { describe, expect, it, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft, listPendingSubmits, QuizDraft } from '../lib/quiz-draft';

// `fake-indexeddb/auto` is loaded via vitest setupFiles — `indexedDB` is global.

function makeDraft(overrides: Partial<QuizDraft> = {}): QuizDraft {
  return {
    attempt_id: 'att-1',
    answers: { 'snap-1': 'opt-a', 'snap-2': null },
    flagged: ['snap-2'],
    current_idx: 1,
    updated_at: 1_700_000_000_000,
    ...overrides,
  };
}

describe('quiz-draft store', () => {
  beforeEach(async () => {
    // fake-indexeddb persists across tests in one process — start each clean.
    await clearDraft('att-1');
    await clearDraft('att-2');
  });

  it('returns null when no draft exists', async () => {
    expect(await loadDraft('att-unknown')).toBeNull();
  });

  it('saves and loads a draft round-trip', async () => {
    const draft = makeDraft();
    await saveDraft(draft);
    expect(await loadDraft('att-1')).toEqual(draft);
  });

  it('overwrites an existing draft for the same attempt', async () => {
    await saveDraft(makeDraft({ current_idx: 1 }));
    await saveDraft(makeDraft({ current_idx: 5, flagged: [] }));
    const loaded = await loadDraft('att-1');
    expect(loaded?.current_idx).toBe(5);
    expect(loaded?.flagged).toEqual([]);
  });

  it('keeps drafts for different attempts separate', async () => {
    await saveDraft(makeDraft({ attempt_id: 'att-1', current_idx: 1 }));
    await saveDraft(makeDraft({ attempt_id: 'att-2', current_idx: 9 }));
    expect((await loadDraft('att-1'))?.current_idx).toBe(1);
    expect((await loadDraft('att-2'))?.current_idx).toBe(9);
  });

  it('clearDraft removes a saved draft', async () => {
    await saveDraft(makeDraft());
    await clearDraft('att-1');
    expect(await loadDraft('att-1')).toBeNull();
  });
});

describe('listPendingSubmits', () => {
  const HOUR = 3_600_000;

  function pending(overrides: Partial<QuizDraft> = {}): QuizDraft {
    return makeDraft({
      submit_pending_at: Date.now() - HOUR,
      submit_payload: [{ snapshot_id: 'snap-1', student_answer: 'opt-a' }],
      quiz_id: 'quiz-1',
      submit_kind: 'full',
      user_id: 'user-a',
      ...overrides,
    });
  }

  beforeEach(async () => {
    for (const id of ['att-1', 'att-2', 'att-3']) await clearDraft(id);
  });

  it('returns a pending draft belonging to the current user', async () => {
    await saveDraft(pending());
    const list = await listPendingSubmits({ userId: 'user-a' });
    expect(list.map((d) => d.attempt_id)).toEqual(['att-1']);
  });

  it('excludes drafts owned by a different user', async () => {
    await saveDraft(pending({ attempt_id: 'att-2', user_id: 'user-b' }));
    expect(await listPendingSubmits({ userId: 'user-a' })).toEqual([]);
  });

  it("does not prune another user's draft", async () => {
    await saveDraft(pending({ attempt_id: 'att-2', user_id: 'user-b' }));
    await listPendingSubmits({ userId: 'user-a' });
    expect(await loadDraft('att-2')).not.toBeNull();
  });

  it('includes legacy drafts that have no user_id', async () => {
    await saveDraft(pending({ user_id: undefined }));
    const list = await listPendingSubmits({ userId: 'user-a' });
    expect(list.map((d) => d.attempt_id)).toEqual(['att-1']);
  });

  it('skips submits younger than minAgeMs (likely still in flight)', async () => {
    await saveDraft(pending({ submit_pending_at: Date.now() - 5_000 }));
    expect(await listPendingSubmits({ userId: 'user-a', minAgeMs: 15_000 })).toEqual([]);
  });

  it('drops and prunes drafts older than maxAgeMs', async () => {
    await saveDraft(pending({ submit_pending_at: Date.now() - 8 * 24 * HOUR }));
    expect(await listPendingSubmits({ userId: 'user-a', maxAgeMs: 7 * 24 * HOUR })).toEqual([]);
    expect(await loadDraft('att-1')).toBeNull();
  });

  it('ignores drafts with no pending submit', async () => {
    await saveDraft(makeDraft({ attempt_id: 'att-3' }));
    expect(await listPendingSubmits({ userId: 'user-a' })).toEqual([]);
  });
});
