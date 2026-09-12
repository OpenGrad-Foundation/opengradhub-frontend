import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PassageCard, QuestionReviewCard } from "@/components/question-review-card";
import type { AttemptReviewQuestion } from "@/lib/api";

// Instruction blocks on the post-attempt review card. Same authored HTML the
// student saw during the attempt (QuestionView) must survive onto review.

function rq(over: Partial<AttemptReviewQuestion> = {}): AttemptReviewQuestion {
  return {
    snapshot_id: "s1",
    section_id: null,
    question_type: "MCQ",
    content_html: "<p>What is 2+2?</p>",
    instruction_html: null,
    image_url: null,
    parent_snapshot_id: null,
    parent_content_html: null,
    parent_instruction_html: null,
    parent_image_url: null,
    student_answer: "a",
    correct_answer: "a",
    is_correct: true,
    marks_awarded: 1,
    time_taken_seconds: 10,
    explanation_video_url: null,
    options: [{ id: "a", option_text: "4", is_correct: true }],
    avg_time_seconds: null,
    batch_correct_count: 0,
    batch_total_count: 0,
    solution_html: null,
    ...over,
  };
}

describe("QuestionReviewCard instruction", () => {
  it("renders the per-question instruction above the question body", () => {
    render(<QuestionReviewCard q={rq({ instruction_html: "<p>Answer in metres.</p>" })} idx={0} revealed={false} />);
    expect(screen.getByText("Answer in metres.")).toBeTruthy();
    expect(screen.getByText("What is 2+2?")).toBeTruthy();
  });

  it("renders nothing for a null or blank instruction", () => {
    const { container: c1 } = render(<QuestionReviewCard q={rq()} idx={0} revealed={false} />);
    expect(c1.textContent).not.toContain("Answer in metres.");
    const { container: c2 } = render(<QuestionReviewCard q={rq({ instruction_html: "  \n " })} idx={0} revealed={true} />);
    // Blank instruction must not add a box; only the question body shows.
    expect(c2.querySelectorAll("[style*='border-left']").length).toBe(0);
  });

  it("still shows the instruction when answers are revealed", () => {
    render(<QuestionReviewCard q={rq({ instruction_html: "<p>Pick one.</p>" })} idx={0} revealed={true} />);
    expect(screen.getByText("Pick one.")).toBeTruthy();
  });
});

describe("PassageCard instruction", () => {
  it("renders the GROUP parent instruction with the passage", () => {
    render(<PassageCard html="<p>The passage.</p>" imageUrl={null} instructionHtml="<p>Read then answer Q1–Q3.</p>" />);
    expect(screen.getByText("Read then answer Q1–Q3.")).toBeTruthy();
    expect(screen.getByText("The passage.")).toBeTruthy();
  });

  it("omits the box when no instruction is given", () => {
    const { container } = render(<PassageCard html="<p>The passage.</p>" imageUrl={null} instructionHtml={null} />);
    expect(container.querySelectorAll("[style*='border-left']").length).toBe(0);
  });
});
