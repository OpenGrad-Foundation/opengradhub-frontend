import { describe, expect, it } from "vitest";
import { flattenGroups } from "@/lib/flatten-groups";
import type { QuizAttemptQuestion } from "@/lib/api";

const leaf = (id: string, section_id: string | null = null): QuizAttemptQuestion => ({
  snapshot_id: id, section_id, question_type: "MCQ", content_html: `<p>${id}</p>`,
  tolerance: null, options: [{ id: `${id}-a`, option_text: "A" }], children: [],
});

describe("flattenGroups", () => {
  it("passes non-group questions through untouched", () => {
    const qs = [leaf("q1"), leaf("q2", "s1")];
    expect(flattenGroups(qs)).toEqual(qs);
  });

  it("splits a GROUP into one entry per child carrying the shared passage", () => {
    const group: QuizAttemptQuestion = {
      snapshot_id: "g", section_id: "s1", question_type: "GROUP",
      content_html: "<p>passage</p>", instruction_html: "<p>read</p>", image_url: "img.png",
      tolerance: null, options: [],
      children: [
        { snapshot_id: "c1", section_id: null, question_type: "MCQ", content_html: "<p>c1</p>", tolerance: null, options: [] },
        { snapshot_id: "c2", section_id: "s1", question_type: "FILL", content_html: "<p>c2</p>", tolerance: null, options: [] },
      ],
    };
    const out = flattenGroups([leaf("q1"), group, leaf("q3")]);
    expect(out.map((q) => q.snapshot_id)).toEqual(["q1", "c1", "c2", "q3"]);
    expect(out[1]).toMatchObject({
      question_type: "MCQ", section_id: "s1", children: [],
      group: { content_html: "<p>passage</p>", instruction_html: "<p>read</p>", image_url: "img.png", part: 1, count: 2 },
    });
    expect(out[2].group).toMatchObject({ part: 2, count: 2 });
    expect(out[0].group).toBeUndefined();
  });

  it("drops a GROUP with no children", () => {
    const empty: QuizAttemptQuestion = { ...leaf("g"), question_type: "GROUP", children: [] };
    expect(flattenGroups([empty, leaf("q1")]).map((q) => q.snapshot_id)).toEqual(["q1"]);
  });
});
