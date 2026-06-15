import { describe, expect, it, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft, QuizDraft } from '../lib/quiz-draft';

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
