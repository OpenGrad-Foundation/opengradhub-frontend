// Client-side practice grader. Mirrors the backend gradeResponse
// (opengradhub-backend/src/quizzes/quiz-grading.ts). Practice scores are not
// authoritative — keep this in sync with the backend if grading rules change.

export type GradableQuestion = {
  question_type: string;
  correct_answer: string | null;
  tolerance: number | null;
  options: { id: string; is_correct: boolean }[];
};

export type PracticeVerdict = {
  is_correct: boolean | null; // null for FILL (manual) and GROUP
  marks_awarded: number;
  max_marks: number;
};

export function gradePractice(
  question: GradableQuestion,
  studentAnswer: string | null,
): PracticeVerdict {
  switch (question.question_type) {
    case 'MCQ': {
      const correct = question.options.find((o) => o.is_correct);
      const ok = !!correct && studentAnswer === correct.id;
      return { is_correct: ok, marks_awarded: ok ? 1 : 0, max_marks: 1 };
    }
    case 'NUMERICAL': {
      const expected = parseFloat(question.correct_answer ?? '');
      const given = parseFloat(studentAnswer ?? '');
      const tol = question.tolerance ?? 0;
      const ok =
        !Number.isNaN(expected) && !Number.isNaN(given) && Math.abs(given - expected) <= tol;
      return { is_correct: ok, marks_awarded: ok ? 1 : 0, max_marks: 1 };
    }
    case 'FILL':
      return { is_correct: null, marks_awarded: 0, max_marks: 1 };
    case 'GROUP':
    default:
      return { is_correct: null, marks_awarded: 0, max_marks: 0 };
  }
}
