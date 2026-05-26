import { describe, expect, it, beforeEach } from 'vitest';
import {
  savePayload, getPayload, saveProgress, getProgress, clearProgress,
  type PracticePayload,
} from '../lib/practiceStore';

const payload: PracticePayload = {
  quiz_id: 'quiz-1',
  quiz_title: 'Mock 1',
  questions: [{
    snapshot_id: 's1', order_index: 0, section_id: null,
    question_type: 'MCQ', content_html: '<p>Q</p>',
    options: [{ id: 'o1', option_text: 'A', is_correct: true }],
    correct_answer: null, tolerance: null, explanation_html: null, children: [],
  }],
};

describe('practiceStore', () => {
  beforeEach(async () => {
    await clearProgress('quiz-1');
  });

  it('round-trips a payload', async () => {
    expect(await getPayload('quiz-1')).toBeNull();
    await savePayload(payload);
    const got = await getPayload('quiz-1');
    expect(got?.quiz_title).toBe('Mock 1');
    expect(got?.questions[0].snapshot_id).toBe('s1');
  });

  it('round-trips and clears progress', async () => {
    expect(await getProgress('quiz-1')).toBeNull();
    await saveProgress('quiz-1', { s1: 'o1' });
    expect(await getProgress('quiz-1')).toEqual({ s1: 'o1' });
    await clearProgress('quiz-1');
    expect(await getProgress('quiz-1')).toBeNull();
  });
});
