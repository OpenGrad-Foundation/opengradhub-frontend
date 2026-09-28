"use client";

import { useState } from "react";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { QuizStudentPreview } from "@/components/quiz-student-preview";
import type { Question, Quiz } from "@/lib/api";

/**
 * A quiz, read the way a quiz reads.
 *
 * Duplication review used to render the material tree through a generic
 * recursive dump: every field of every node, all expanded, in one column. It
 * carried the right information in the wrong shape — you could not tell a
 * section from a setting, or scan the questions.
 *
 * Courses had an existing read-only view to fall back on. Quizzes had none —
 * every other quiz surface either edits (the builder, the slide-over) or is
 * bound to an attempt (the review card) — so this is that missing view: the
 * quiz's own settings, its sections, and its questions with the answer key,
 * and nothing that writes. The student experience stays one click away rather
 * than being the only way to read the questions.
 */
export function QuizMaterialView({ quiz }: { quiz: Quiz }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const sectioned = quiz.is_sectioned && quiz.sections.length > 0;
  const flatCount = sectioned
    ? quiz.sections.reduce((sum, section) => sum + section.questions.length, 0)
    : quiz.questions.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <section style={card}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <p style={label}>Read only</p>
            <h1 style={{ ...heading, fontSize: "24px", margin: "6px 0 8px" }}>{quiz.title}</h1>
            {quiz.description && (
              <div style={{ fontSize: "14px", color: "rgba(3,72,82,0.65)", lineHeight: 1.6 }}>
                <MathContent html={quiz.description} />
              </div>
            )}
            <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
              <Tag>{quiz.effective_scope_mode === "GLOBAL" ? "Shared with all programmes" : quiz.owner_programme_name ?? "Unassigned"}</Tag>
              <Tag>{quiz.published ? "Published" : "Draft"}</Tag>
              <Tag>{flatCount} question{flatCount === 1 ? "" : "s"}</Tag>
            </div>
          </div>
          <button type="button" onClick={() => setPreviewOpen(true)} style={outlineBtn}>
            Preview as student
          </button>
        </div>

        <dl style={settingsGrid}>
          <Setting k="Duration" v={quiz.duration_minutes ? `${quiz.duration_minutes} min` : "Untimed"} />
          <Setting k="Attempts" v={quiz.max_attempts ? String(quiz.max_attempts) : "Unlimited"} />
          <Setting k="Pass mark" v={quiz.pass_threshold_percent != null ? `${quiz.pass_threshold_percent}%` : "—"} />
          {/* The marking scheme is the number an author actually compares; a
              bare "Yes" for negative marking says nothing useful. */}
          <Setting k="Marking" v={quiz.negative_marking ? `+${quiz.correct_marks} / −${quiz.wrong_marks}` : `+${quiz.correct_marks}`} />
          <Setting k="Sections" v={sectioned ? `${quiz.sections.length}${quiz.sequential_sections ? " (in order)" : ""}` : "None"} />
          <Setting k="Shuffled" v={quiz.shuffle_questions ? "Yes" : "No"} />
          <Setting k="Answers shown after" v={quiz.show_answers_after ? "Yes" : "No"} />
          <Setting k="Fullscreen" v={quiz.require_fullscreen ? "Required" : "No"} />
        </dl>
      </section>

      {flatCount === 0 ? (
        <section style={card}>
          <p style={{ margin: 0, ...muted }}>This quiz has no questions yet.</p>
        </section>
      ) : sectioned ? (
        quiz.sections.map((section, sectionIndex) => (
          <section key={section.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
              <h2 style={{ ...heading, fontSize: "17px", margin: 0 }}>
                Section {sectionIndex + 1} · {section.title}
              </h2>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {section.duration_minutes != null && <Tag>{section.duration_minutes} min</Tag>}
                {section.pass_threshold_percent != null && <Tag>Pass {section.pass_threshold_percent}%</Tag>}
                <Tag>{section.questions.length} question{section.questions.length === 1 ? "" : "s"}</Tag>
              </div>
            </div>
            <QuestionList questions={section.questions} />
          </section>
        ))
      ) : (
        <section style={card}>
          <QuestionList questions={quiz.questions} />
        </section>
      )}

      {previewOpen && <QuizStudentPreview quiz={quiz} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

/**
 * The questions of one quiz, sectioned or not.
 *
 * Exported because a course's own quizzes need the same rendering when opened
 * from the course view: before this they fell through to a generic field dump,
 * so the same question looked different depending on how you reached it.
 */
export function QuizQuestions({ sections, questions }: {
  sections?: { id: string; title: string; duration_minutes: number | null; pass_threshold_percent: number | null; questions: Question[] }[];
  questions?: Question[];
}) {
  const hasSections = !!sections?.length;
  if (!hasSections && !questions?.length) {
    return <p style={{ margin: 0, ...muted, fontSize: "13px" }}>This quiz has no questions yet.</p>;
  }
  if (!hasSections) return <QuestionList questions={questions ?? []} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {sections!.map((section, index) => (
        <div key={section.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
            <h4 style={{ ...heading, fontSize: "14px", margin: 0 }}>Section {index + 1} · {section.title}</h4>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {section.duration_minutes != null && <Tag>{section.duration_minutes} min</Tag>}
              {section.pass_threshold_percent != null && <Tag>Pass {section.pass_threshold_percent}%</Tag>}
            </div>
          </div>
          <QuestionList questions={section.questions} />
        </div>
      ))}
    </div>
  );
}

function QuestionList({ questions }: { questions: Question[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {questions.map((question, index) => (
        <QuestionBlock key={question.id} question={question} index={index} isLast={index === questions.length - 1} />
      ))}
    </div>
  );
}

function QuestionBlock({ question, index, isLast, nested = false }: {
  question: Question;
  index: number;
  isLast: boolean;
  nested?: boolean;
}) {
  const marks = question.marks != null ? ` · ${question.marks} mark${question.marks === 1 ? "" : "s"}` : "";
  // Two endpoints feed this: the quiz preview returns a full question row, the
  // course preview a leaner projection that may omit either collection.
  const options = question.options ?? [];
  const children = question.children ?? [];
  return (
    <div style={{
      padding: nested ? "12px 0 12px 16px" : "16px 0",
      borderBottom: isLast ? "none" : "1px solid rgba(3,72,82,0.07)",
      borderLeft: nested ? "2px solid rgba(3,72,82,0.12)" : undefined,
      marginLeft: nested ? "8px" : undefined,
    }}>
      <p style={{ ...muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
        {nested ? `Part ${index + 1}` : `Q${index + 1}`} · {question.question_type}{marks}
      </p>

      {question.instruction_html && (
        <div style={{ marginTop: "6px", ...muted, fontSize: "13px" }}>
          <MathContent html={question.instruction_html} />
        </div>
      )}

      <div style={{ marginTop: "6px", fontSize: "14px", color: "#034852" }}>
        <MathContent html={question.content_html} />
      </div>

      {question.image_url && isHttpUrl(question.image_url) && (
        <img src={question.image_url} alt="" style={{ marginTop: "10px", maxWidth: "100%", maxHeight: "360px", objectFit: "contain", borderRadius: "10px" }} />
      )}

      {options.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: "6px" }}>
          {options.map((option) => (
            <li key={option.id} style={{
              fontSize: "13px",
              color: option.is_correct ? "#0abe62" : "rgba(3,72,82,0.75)",
              fontWeight: option.is_correct ? 700 : 400,
              display: "flex", gap: "8px", alignItems: "baseline",
            }}>
              <span aria-hidden style={{ flexShrink: 0 }}>{option.is_correct ? "✓" : "○"}</span>
              <MathContent inline html={option.option_text} />
            </li>
          ))}
        </ul>
      )}

      {options.length === 0 && question.correct_answer != null && (
        <p style={{ margin: "10px 0 0", fontSize: "13px", color: "rgba(3,72,82,0.75)" }}>
          Answer: <strong style={{ color: "#0abe62" }}>{question.correct_answer}</strong>
        </p>
      )}

      {question.solution && (
        <div style={{ marginTop: "10px", fontSize: "13px", color: "rgba(3,72,82,0.75)" }}>
          <strong>Solution: </strong><MathContent inline html={question.solution} />
        </div>
      )}

      {question.explanation_video_url && isHttpUrl(question.explanation_video_url) && (
        <a href={question.explanation_video_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: "8px", fontSize: "13px", color: "#209379", fontWeight: 600 }}>
          Explanation video ↗
        </a>
      )}

      {children.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          {children.map((child, childIndex) => (
            <QuestionBlock
              key={child.id}
              question={child}
              index={childIndex}
              isLast={childIndex === children.length - 1}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Setting({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ background: "rgba(248,250,251,0.95)", borderRadius: "12px", padding: "10px 12px" }}>
      <dt style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(3,72,82,0.5)" }}>{k}</dt>
      <dd style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 600, color: "#034852" }}>{v}</dd>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.6)" }}>
      {children}
    </span>
  );
}

function isHttpUrl(value: string): boolean { return /^https?:\/\//i.test(value); }

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px",
  padding: "24px 28px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
};
const settingsGrid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "10px", margin: "18px 0 0",
};
const label: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};
const heading: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" };
const muted: React.CSSProperties = { color: "rgba(3,72,82,0.55)" };
const outlineBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.18)",
  background: "#fff", color: "#034852", fontSize: "13px", fontWeight: 700, cursor: "pointer",
  flexShrink: 0,
};
