import { describe, expect, it } from 'vitest';
import type { ParsedBulkQuiz, ParseDiagnostic } from '@/lib/api';
import {
  applyDiagnosticFix,
  diagsForQuestion,
  hasStructuralIssue,
  splitDiagnostics,
  stripOccurrence,
  whereKey,
} from '@/lib/quiz-import-diagnostics';

const quiz = (): ParsedBulkQuiz => ({
  title: 'T',
  sections: [{
    title: 'S',
    questions: [{
      content: 'Stem line\nTopic: Averages\nTopic: Averages',
      question_type: 'MCQ',
      options: [{ text: 'a', is_correct: true }, { text: 'b', is_correct: false }],
    }],
  }],
});

describe('splitDiagnostics / structural detection', () => {
  it('routes parser codes to syntactic and validator codes to semantic', () => {
    const all: ParseDiagnostic[] = [
      { code: 'UNKNOWN_TAG', severity: 'error', message: '', where: { s: 0, q: 0 } },
      { code: 'MISSING_SUBJECT', severity: 'warning', message: '', where: { s: 0, q: 0 } },
    ];
    const { syntactic, semantic } = splitDiagnostics(all);
    expect(syntactic.map((d) => d.code)).toEqual(['UNKNOWN_TAG']);
    expect(semantic.map((d) => d.code)).toEqual(['MISSING_SUBJECT']);
  });

  it('flags structural issues but ignores info-severity ones', () => {
    expect(hasStructuralIssue([
      { code: 'QUESTION_NUMBER_GAP', severity: 'warning', message: '', where: { s: 0, q: 1 } },
    ])).toBe(true);
    expect(hasStructuralIssue([
      { code: 'MISSING_SUBJECT', severity: 'warning', message: '', where: { s: 0, q: 0 } },
    ])).toBe(false);
  });
});

describe('whereKey / diagsForQuestion', () => {
  it('keys quiz, section, question and child locations distinctly', () => {
    expect(whereKey('quiz')).toBe('quiz');
    expect(whereKey({ s: 1 })).toBe('s1');
    expect(whereKey({ s: 1, q: 2 })).toBe('s1q2');
    expect(whereKey({ s: 1, q: 2, child: 0 })).toBe('s1q2c0');
  });

  it('rolls child diagnostics up onto their parent row', () => {
    const all: ParseDiagnostic[] = [
      { code: 'X', severity: 'error', message: '', where: { s: 0, q: 1, child: 2 } },
      { code: 'Y', severity: 'error', message: '', where: { s: 0, q: 0 } },
    ];
    expect(diagsForQuestion(all, 0, 1).map((d) => d.code)).toEqual(['X']);
  });
});

describe('stripOccurrence', () => {
  it('removes exactly the addressed copy of a duplicated line', () => {
    expect(stripOccurrence('a\nx\nb\nx', 'x', 1)).toBe('a\nx\nb');
    expect(stripOccurrence('a\nx\nb\nx', 'x', 0)).toBe('a\nb\nx');
  });

  it('is a no-op when the occurrence is gone', () => {
    expect(stripOccurrence('a\nb', 'x', 0)).toBe('a\nb');
  });
});

describe('applyDiagnosticFix', () => {
  const moveDiag: ParseDiagnostic = {
    code: 'UNBRACKETED_TAG', severity: 'warning', message: '',
    where: { s: 0, q: 0 }, raw: 'Topic: Averages',
    fix: { op: 'move', field: 'topic', value: 'Averages', from: 'content', occurrence: 0 },
  };

  it('apply on a move fix sets the field AND strips the addressed line', () => {
    const next = applyDiagnosticFix(quiz(), moveDiag, 'apply')!;
    const q = next.sections[0].questions[0];
    expect(q.topic).toBe('Averages');
    expect(q.content).toBe('Stem line\nTopic: Averages'); // second copy untouched
  });

  it('discard strips the line without setting anything', () => {
    const next = applyDiagnosticFix(quiz(), moveDiag, 'discard')!;
    const q = next.sections[0].questions[0];
    expect(q.topic).toBeUndefined();
    expect(q.content).toBe('Stem line\nTopic: Averages');
  });

  it('append adds a quarantined raw line to the content', () => {
    const quarantined: ParseDiagnostic = {
      code: 'UNKNOWN_TAG', severity: 'error', message: '',
      where: { s: 0, q: 0 }, raw: '[DIFFICULT] Medium',
      fix: { op: 'set', field: 'difficulty', value: 'Medium' },
    };
    const next = applyDiagnosticFix(quiz(), quarantined, 'append')!;
    expect(next.sections[0].questions[0].content).toContain('[DIFFICULT] Medium');
  });

  it('apply on a set fix writes the field on a group child', () => {
    const g = quiz();
    g.sections[0].questions.push({
      content: 'Passage', question_type: 'GROUP', options: [],
      children: [{ content: 'c', question_type: 'MCQ', options: [] }],
    });
    const diag: ParseDiagnostic = {
      code: 'UNKNOWN_TAG', severity: 'error', message: '',
      where: { s: 0, q: 1, child: 0 }, raw: '[SUBJCT] Math',
      fix: { op: 'set', field: 'subject', value: 'Math' },
    };
    const next = applyDiagnosticFix(g, diag, 'apply')!;
    expect(next.sections[0].questions[1].children![0].subject).toBe('Math');
    // untouched siblings survive structurally
    expect(next.sections[0].questions[0].options).toHaveLength(2);
  });

  it('returns null (resolved, nothing to change) for a quarantined discard', () => {
    const quarantined: ParseDiagnostic = {
      code: 'UNKNOWN_TAG', severity: 'error', message: '',
      where: { s: 0, q: 0 }, raw: '[DIFFICULT] Medium',
      fix: { op: 'set', field: 'difficulty', value: 'Medium' },
    };
    expect(applyDiagnosticFix(quiz(), quarantined, 'discard')).toBeNull();
  });
});
