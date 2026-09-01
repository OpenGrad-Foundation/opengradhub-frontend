import { describe, expect, it } from 'vitest';
import type { ParsedBulkQuiz, ParseDiagnostic } from '@/lib/api';
import { applySourceFix, diagnosticJumpLine, sourceFixLabel } from '@/lib/quiz-source-fixes';

const SRC = [
  '[SECTION] A',          // 1
  'Q.1) What?',           // 2
  '*[A] x',               // 3
  '[DIFFICULT] Medium',   // 4
  'Topic: Averages',      // 5
  '[TOPIC]: Algebra',     // 6
  '',                     // 7
  'Q.2) Next',            // 8
  '[A] 9.8',              // 9
].join('\n');

const quiz: ParsedBulkQuiz = {
  sections: [{
    title: 'A', line: 1,
    questions: [
      { content: 'What?', number: 1, line: 2, question_type: 'MCQ', options: [{ text: 'x', is_correct: true }], difficulty: 'Med' },
      { content: 'Next', number: 2, line: 8, question_type: 'NUMERICAL', options: [], correct_answer: '9.8' },
    ],
  }],
};

const d = (over: Partial<ParseDiagnostic>): ParseDiagnostic => ({
  code: 'X', severity: 'warning', message: '', where: { s: 0, q: 0 }, ...over,
});

const lineOf = (text: string, n: number) => text.split('\n')[n - 1];

describe('applySourceFix', () => {
  it('renames a typo tag in place', () => {
    const r = applySourceFix(SRC, d({ code: 'UNKNOWN_TAG', line: 4, suggestedTag: 'DIFFICULTY' }), quiz)!;
    expect(lineOf(r.text, 4)).toBe('[DIFFICULTY] Medium');
    expect(r.cursorLine).toBe(4);
  });

  it('brackets an unbracketed tag-like line', () => {
    const r = applySourceFix(SRC, d({ code: 'UNBRACKETED_TAG', line: 5, suggestedTag: 'TOPIC' }), quiz)!;
    expect(lineOf(r.text, 5)).toBe('[TOPIC] Averages');
  });

  it('removes a stray colon after a tag', () => {
    const r = applySourceFix(SRC, d({ code: 'VALUE_TRIMMED', line: 6 }), quiz)!;
    expect(lineOf(r.text, 6)).toBe('[TOPIC] Algebra');
  });

  it("inserts a missing tag line at the end of the question's block, before the blank gap", () => {
    const r = applySourceFix(SRC, d({ code: 'MISSING_SUBJECT' }), quiz)!;
    const lines = r.text.split('\n');
    expect(lines[6]).toBe('[SUBJECT] ');      // new line 7
    expect(lines[7]).toBe('');                // gap preserved
    expect(lines[8]).toBe('Q.2) Next');
    expect(r.cursorLine).toBe(7);
    expect(r.needsInput).toBe(true);
  });

  it('adds an explicit [QUESTION TYPE] right after the question line for an inferred type', () => {
    const r = applySourceFix(SRC, d({ code: 'TYPE_INFERRED', where: { s: 0, q: 1 } }), quiz)!;
    const lines = r.text.split('\n');
    expect(lines[7]).toBe('Q.2) Next');
    expect(lines[8]).toBe('[QUESTION TYPE] Numerical');
    expect(lines[9]).toBe('[A] 9.8');
  });

  it('prepends a title line', () => {
    const r = applySourceFix(SRC, d({ code: 'MISSING_TITLE', where: 'quiz' }), quiz)!;
    expect(r.text.split('\n')[0]).toBe('[TEST TITLE] ');
    expect(r.cursorLine).toBe(1);
  });

  it('rewrites a non-canonical difficulty value inside the block', () => {
    const src = SRC.replace('[DIFFICULT] Medium', '[DIFFICULTY] Med');
    const r = applySourceFix(src, d({ code: 'DIFFICULTY_UNKNOWN', fix: { op: 'set', field: 'difficulty', value: 'MEDIUM' } }), quiz)!;
    expect(lineOf(r.text, 4)).toBe('[DIFFICULTY] MEDIUM');
  });

  it('declines when there is no safe repair', () => {
    expect(applySourceFix(SRC, d({ code: 'MCQ_NO_CORRECT' }), quiz)).toBeNull();
    expect(applySourceFix(SRC, d({ code: 'UNKNOWN_TAG', line: 4 }), quiz)).toBeNull(); // no suggestion
    expect(sourceFixLabel(d({ code: 'QUESTION_NUMBER_GAP', line: 8 }))).toBeNull();
  });
});

describe('diagnosticJumpLine', () => {
  it('prefers the diagnostic line, then the question line, then the section line', () => {
    expect(diagnosticJumpLine(d({ line: 5 }), quiz)).toBe(5);
    expect(diagnosticJumpLine(d({ where: { s: 0, q: 1 } }), quiz)).toBe(8);
    expect(diagnosticJumpLine(d({ where: { s: 0 } }), quiz)).toBe(1);
    expect(diagnosticJumpLine(d({ where: 'quiz' }), quiz)).toBe(1);
  });
});
