import type { QuizAttemptQuestion } from "./api";

export type SectionStats = {
  total: number;
  answered: number;
  unanswered: number;
  flagged: number;
  flaggedAndAnswered: number;
};

/**
 * Counts answer/flag state across a list of questions. GROUP children are
 * counted individually; the GROUP parent itself does not count toward totals.
 */
export function computeSectionStats(
  questions: QuizAttemptQuestion[],
  answers: Record<string, string | null>,
  flagged: Set<string>,
): SectionStats {
  let total = 0;
  let answered = 0;
  let flaggedCount = 0;
  let flaggedAndAnswered = 0;

  function tally(snapshotId: string) {
    total += 1;
    const ans = answers[snapshotId];
    const isAnswered = ans != null && ans !== "";
    const isFlagged = flagged.has(snapshotId);
    if (isAnswered) answered += 1;
    if (isFlagged) flaggedCount += 1;
    if (isAnswered && isFlagged) flaggedAndAnswered += 1;
  }

  for (const q of questions) {
    if (q.question_type === "GROUP") {
      for (const c of q.children) tally(c.snapshot_id);
    } else {
      tally(q.snapshot_id);
    }
  }

  return {
    total,
    answered,
    unanswered: total - answered,
    flagged: flaggedCount,
    flaggedAndAnswered,
  };
}
