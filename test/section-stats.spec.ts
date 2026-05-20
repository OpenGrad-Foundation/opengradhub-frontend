import { describe, expect, it } from "vitest";
import { computeSectionStats } from "../lib/section-stats";
import type { QuizAttemptQuestion } from "../lib/api";

function mcq(snapshot_id: string): QuizAttemptQuestion {
  return {
    snapshot_id,
    question_type: "MCQ",
    content_html: "<p>q</p>",
    correct_answer: null,
    tolerance: null,
    options: [],
    children: [],
  };
}
function group(snapshot_id: string, childIds: string[]): QuizAttemptQuestion {
  return {
    snapshot_id,
    question_type: "GROUP",
    content_html: "<p>g</p>",
    correct_answer: null,
    tolerance: null,
    options: [],
    children: childIds.map((id) => ({
      snapshot_id: id,
      question_type: "MCQ",
      content_html: "",
      correct_answer: null,
      tolerance: null,
      options: [],
    })),
  };
}

describe("computeSectionStats", () => {
  it("empty list", () => {
    expect(computeSectionStats([], {}, new Set())).toEqual({
      total: 0, answered: 0, unanswered: 0, flagged: 0, flaggedAndAnswered: 0,
    });
  });

  it("counts answered MCQs, leaves blanks as unanswered", () => {
    const qs = [mcq("a"), mcq("b"), mcq("c")];
    const answers = { a: "x", b: null, c: "" };
    expect(computeSectionStats(qs, answers, new Set())).toMatchObject({
      total: 3, answered: 1, unanswered: 2,
    });
  });

  it("counts flagged and the intersection with answered", () => {
    const qs = [mcq("a"), mcq("b"), mcq("c")];
    const answers = { a: "x", b: "y" };
    const flagged = new Set(["a", "c"]);
    expect(computeSectionStats(qs, answers, flagged)).toEqual({
      total: 3, answered: 2, unanswered: 1, flagged: 2, flaggedAndAnswered: 1,
    });
  });

  it("counts GROUP children individually, not the parent", () => {
    const qs = [group("g1", ["c1", "c2"]), mcq("m1")];
    const answers = { c1: "x", m1: "y" };
    const flagged = new Set(["c2"]);
    expect(computeSectionStats(qs, answers, flagged)).toEqual({
      total: 3,        // c1 + c2 + m1, not g1
      answered: 2,
      unanswered: 1,
      flagged: 1,
      flaggedAndAnswered: 0,
    });
  });
});
