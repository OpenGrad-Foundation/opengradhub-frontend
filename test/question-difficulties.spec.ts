import { describe, expect, it } from 'vitest';
import {
  QUESTION_DIFFICULTIES,
  canonDifficulty,
  isCanonicalDifficulty,
} from '@/lib/question-difficulties';

/**
 * Frontend mirror of opengradhub-backend/src/common/question-difficulties.ts.
 * The two files are edited by hand because the packages cannot import each
 * other; this spec is what notices when only one side was edited.
 */
describe('question-difficulty mirror', () => {
  it('carries exactly the difficulties the backend accepts', () => {
    expect([...QUESTION_DIFFICULTIES]).toEqual(['EASY', 'MEDIUM', 'HARD']);
  });

  it('canonicalises case-insensitive matches and leaves the rest alone', () => {
    expect(canonDifficulty('easy')).toBe('EASY');
    expect(canonDifficulty(' Medium ')).toBe('MEDIUM');
    expect(canonDifficulty('Med')).toBe('Med');
    expect(canonDifficulty(null)).toBeNull();
  });

  it('recognises only exact canonical values', () => {
    expect(isCanonicalDifficulty('EASY')).toBe(true);
    expect(isCanonicalDifficulty('Easy')).toBe(false);
  });
});
