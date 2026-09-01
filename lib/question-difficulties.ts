// Source of truth for the question-difficulty whitelist.
// MIRRORED by opengradhub-backend/src/common/question-difficulties.ts
// (separate package, cannot import). A spec on each side guards drift — the
// same arrangement programme-kinds and lib/geo use.

export const QUESTION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

/** True only for an exact canonical value. */
export function isCanonicalDifficulty(v: string | null | undefined): v is QuestionDifficulty {
  return v != null && (QUESTION_DIFFICULTIES as readonly string[]).includes(v);
}

/**
 * Canonicalise a difficulty: "easy" / " Easy " → "EASY". A value that matches
 * no known difficulty is returned unchanged — the import validator flags it.
 */
export function canonDifficulty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const up = v.trim().toUpperCase();
  return (QUESTION_DIFFICULTIES as readonly string[]).includes(up) ? up : v;
}
