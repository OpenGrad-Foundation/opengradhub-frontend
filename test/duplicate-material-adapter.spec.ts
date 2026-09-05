import { describe, it, expect } from "vitest";
import { materialToCourseView } from "@/lib/duplicate-material";

/**
 * The duplicate preview already returns the whole course tree. This adapter is
 * what lets the ordinary read-only course view render it, so a reviewer walks
 * the course the way any view-only staff member would instead of reading a
 * flat dump of every field at once.
 */
const PREVIEW = {
  course: {
    id: "c1",
    title: "Algebra I",
    description: "Intro course",
    programme_type: "UG",
    locking_mode: "SEQUENTIAL",
    cover_image_url: null,
  },
  modules: [
    {
      id: "m1",
      title: "Module One",
      order_index: 0,
      lessons: [
        { id: "l1", title: "Lesson A", youtube_url: "https://youtu.be/a", duration_minutes: 10, notes_html: "<p>notes</p>", order_index: 0 },
        { id: "l2", title: "Lesson B", youtube_url: null, duration_minutes: null, notes_html: null, order_index: 2 },
      ],
      quizzes: [
        {
          id: "q1",
          title: "Check 1",
          description: null,
          quiz_type: "MODULE_TEST",
          is_sectioned: false,
          order_index: 1,
          sections: [],
          questions: [{ id: "qq1", content_html: "2+2?", options: [{ id: "o1", option_text: "4", is_correct: true }] }],
        },
      ],
    },
  ],
};

describe("materialToCourseView", () => {
  it("maps the course header straight through", () => {
    const { course } = materialToCourseView(PREVIEW);
    expect(course.title).toBe("Algebra I");
    expect(course.locking_mode).toBe("SEQUENTIAL");
    expect(course.description).toBe("Intro course");
  });

  it("carries lesson content, so a lesson opens without a second request", () => {
    const { modules } = materialToCourseView(PREVIEW);
    const [lessonA, lessonB] = modules[0].lessons;
    expect(lessonA).toMatchObject({
      id: "l1",
      module_id: "m1",
      title: "Lesson A",
      notes_html: "<p>notes</p>",
      youtube_url: "https://youtu.be/a",
      duration_minutes: 10,
    });
    // A lesson with no notes or video still renders as a row.
    expect(lessonB.notes_html).toBeNull();
    expect(lessonB.youtube_url).toBe("");
  });

  it("reports no progress at all — this is material, not a learner's course", () => {
    const { modules } = materialToCourseView(PREVIEW);
    expect(modules[0].is_module_complete).toBe(false);
    expect(modules[0].is_locked).toBe(false);
    expect(modules[0].lessons.every((lesson) => lesson.is_complete === false)).toBe(true);
    expect(modules[0].module_quizzes.every((quiz) => quiz.is_complete === false)).toBe(true);
  });

  it("keeps quizzes in curriculum order alongside lessons", () => {
    const { modules } = materialToCourseView(PREVIEW);
    expect(modules[0].module_quizzes[0]).toMatchObject({ id: "q1", title: "Check 1", order_index: 1 });
  });

  it("indexes each quiz's questions so the row can open them in place", () => {
    const { quizMaterial } = materialToCourseView(PREVIEW);
    expect(Object.keys(quizMaterial)).toEqual(["q1"]);
    expect(quizMaterial.q1.questions?.[0]).toMatchObject({ id: "qq1", content_html: "2+2?" });
  });

  it("survives a preview with nothing in it", () => {
    const empty = materialToCourseView({ course: { id: "c9", title: "Empty" }, modules: [] });
    expect(empty.modules).toEqual([]);
    expect(empty.quizMaterial).toEqual({});
    expect(empty.course.title).toBe("Empty");
  });
});
