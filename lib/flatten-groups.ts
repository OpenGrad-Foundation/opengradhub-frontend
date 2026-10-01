import type { QuizAttemptQuestion } from "./api";

/**
 * Splits every GROUP question into its child questions so each part gets its
 * own palette slot ("Q5, Q6, Q7, Q8" instead of one "Q5 (group)"). Each child
 * carries `group` — the shared passage plus its part number — so the exam view
 * repeats the passage beside every part. Children inherit the parent's
 * section_id because child snapshots may report a null one.
 */
export function flattenGroups(questions: QuizAttemptQuestion[]): QuizAttemptQuestion[] {
  return questions.flatMap((q) => {
    if (q.question_type !== "GROUP") return [q];
    return q.children.map((child, i) => ({
      ...child,
      section_id: child.section_id ?? q.section_id ?? null,
      children: [],
      group: {
        content_html: q.content_html,
        instruction_html: q.instruction_html ?? null,
        image_url: q.image_url ?? null,
        part: i + 1,
        count: q.children.length,
      },
    }));
  });
}
