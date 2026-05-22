import { describe, expect, it } from 'vitest';
import { gradePractice, type GradableQuestion } from '../lib/practiceGrader';

const mcq: GradableQuestion = {
  question_type: 'MCQ', correct_answer: null, tolerance: null,
  options: [{ id: 'o1', is_correct: true }, { id: 'o2', is_correct: false }],
};
const numerical: GradableQuestion = {
  question_type: 'NUMERICAL', correct_answer: '10', tolerance: 0.5, options: [],
};

describe('gradePractice', () => {
  it('MCQ — correct option', () => {
    expect(gradePractice(mcq, 'o1')).toEqual({ is_correct: true, marks_awarded: 1, max_marks: 1 });
  });
  it('MCQ — wrong option', () => {
    expect(gradePractice(mcq, 'o2')).toEqual({ is_correct: false, marks_awarded: 0, max_marks: 1 });
  });
  it('NUMERICAL — within tolerance', () => {
    expect(gradePractice(numerical, '10.4').is_correct).toBe(true);
  });
  it('NUMERICAL — outside tolerance', () => {
    expect(gradePractice(numerical, '11').is_correct).toBe(false);
  });
  it('FILL — manual, no verdict', () => {
    expect(gradePractice({ question_type: 'FILL', correct_answer: null, tolerance: null, options: [] }, 'x'))
      .toEqual({ is_correct: null, marks_awarded: 0, max_marks: 1 });
  });
  it('GROUP — contributes nothing', () => {
    expect(gradePractice({ question_type: 'GROUP', correct_answer: null, tolerance: null, options: [] }, null))
      .toEqual({ is_correct: null, marks_awarded: 0, max_marks: 0 });
  });
});
