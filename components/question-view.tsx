"use client";

import { MathContent } from "@/app/dashboard/_components/MathContent";
import { type QuizAttemptQuestion } from "@/lib/api";
import examStyles from "./quiz-exam.module.css";

export type AnswerMap = Record<string, string | null>; // snapshot_id → student_answer

const optionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  borderRadius: "10px",
  marginBottom: "10px",
  cursor: "pointer",
  border: "1.5px solid rgba(3,72,82,0.12)",
  transition: "all 0.15s",
};

export function QuestionView({
  q,
  answers,
  setAnswer,
  renderReportButton,
  exam = false,
}: {
  q: QuizAttemptQuestion;
  answers: AnswerMap;
  setAnswer: (snapshotId: string, val: string | null) => void;
  /**
   * Opt-in per-leaf "report this question" control. GROUP parents are not answerable,
   * so only children get one — a report must name the child that is actually broken.
   * Surfaces without a real attempt behind them (e.g. the staff preview) omit this.
   */
  renderReportButton?: (snapshotId: string) => React.ReactNode;
  exam?: boolean;
}) {
  const current = answers[q.snapshot_id] ?? null;

  if (exam && (q.question_type === "GROUP" || q.instruction_html?.trim())) {
    return (
      <div className={examStyles.splitQuestion}>
        <section className={examStyles.passage} aria-label="Passage and instructions">
          <h3>{q.question_type === "GROUP" ? "Passage / question set" : "Passage / instructions"}</h3>
          {q.instruction_html?.trim() && <MathContent html={q.instruction_html} />}
          {q.question_type === "GROUP" && <>
            <MathContent html={q.content_html} />
            {q.image_url && <img src={q.image_url} alt="Passage image" style={{ maxWidth: "100%" }} />}
          </>}
        </section>
        <div className={examStyles.answerPane}>
          {q.question_type === "GROUP" ? q.children.map((child, i) => (
            <section key={child.snapshot_id} style={{ marginBottom: 28 }} aria-label={`Part ${i + 1}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <strong>Part {i + 1}</strong>{renderReportButton?.(child.snapshot_id)}
              </div>
              <QuestionView q={{ ...child, children: [] }} answers={answers} setAnswer={setAnswer} exam />
            </section>
          )) : <QuestionView q={{ ...q, instruction_html: null }} answers={answers} setAnswer={setAnswer} exam />}
        </div>
      </div>
    );
  }

  return (
    <div>
      {q.question_type !== "GROUP" && (
        <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.4)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {q.question_type === "MCQ" ? "Multiple Choice" : q.question_type === "NUMERICAL" ? "Numeric" : q.question_type === "ESSAY" ? "Essay" : "Fill in the Blank"}
        </p>
      )}

      {q.instruction_html != null && q.instruction_html.trim() !== "" && (
        <div style={{
          background: "rgba(3,72,82,0.04)",
          border: "1px solid rgba(3,72,82,0.12)",
          borderLeft: "3px solid #209379",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
        }}>
          <MathContent html={q.instruction_html} style={{ fontSize: "14px", lineHeight: 1.7, color: "#034852" }} />
        </div>
      )}

      <MathContent
        html={q.content_html}
        style={{ fontSize: "16px", fontWeight: 600, lineHeight: 1.6, marginBottom: q.image_url ? "16px" : "24px" }}
      />

      {q.image_url && (
        <div style={{ marginBottom: "24px" }}>
          <img
            src={q.image_url}
            alt="Question image"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid rgba(3,72,82,0.1)", display: "block" }}
          />
        </div>
      )}

      {q.question_type === "MCQ" && q.options.length > 0 && (
        <div role={exam ? "radiogroup" : undefined} aria-label={exam ? "Answer options" : undefined}>
          {q.options.map((opt, index) => {
            const selected = current === opt.id;
            if (exam) return (
              <button type="button" key={opt.id} role="radio" aria-checked={selected}
                tabIndex={selected || (current == null && index === 0) ? 0 : -1}
                className={examStyles.option} onClick={() => setAnswer(q.snapshot_id, opt.id)}
                onKeyDown={event => {
                  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
                  event.preventDefault();
                  const next = (index + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + q.options.length) % q.options.length;
                  setAnswer(q.snapshot_id, q.options[next].id);
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                  buttons?.[next]?.focus();
                }}>
                <span className={examStyles.radio} aria-hidden="true" />
                <MathContent inline html={opt.option_text} style={{ fontSize: "15px" }} />
              </button>
            );
            return (
              <div
                key={opt.id}
                onClick={() => setAnswer(q.snapshot_id, selected ? null : opt.id)}
                style={{
                  ...optionRow,
                  background: selected ? "rgba(10,190,98,0.08)" : "transparent",
                  borderColor: selected ? "#0abe62" : "rgba(3,72,82,0.12)",
                }}
              >
                <div style={{
                  width: "18px", height: "18px", borderRadius: "50%",
                  border: `2px solid ${selected ? "#0abe62" : "rgba(3,72,82,0.3)"}`,
                  background: selected ? "#0abe62" : "transparent",
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {selected && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />}
                </div>
                <MathContent inline html={opt.option_text} style={{ fontSize: "15px" }} />
              </div>
            );
          })}
        </div>
      )}

      {(q.question_type === "NUMERICAL" || q.question_type === "FILL") && (
        <input
          type={q.question_type === "NUMERICAL" ? "number" : "text"}
          aria-label="Your answer"
          placeholder={q.question_type === "NUMERICAL" ? "Enter a number…" : "Type your answer…"}
          value={current ?? ""}
          onChange={(e) => setAnswer(q.snapshot_id, e.target.value || null)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1.5px solid rgba(3,72,82,0.2)",
            fontSize: exam ? "16px" : "15px",
            color: "#034852",
            outline: exam ? undefined : "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {q.question_type === "ESSAY" && (
        <textarea
          aria-label="Your essay answer"
          placeholder="Type your essay answer here…"
          value={current ?? ""}
          onChange={(e) => setAnswer(q.snapshot_id, e.target.value || null)}
          rows={6}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1.5px solid rgba(3,72,82,0.2)",
            fontSize: exam ? "16px" : "15px",
            color: "#034852",
            outline: exam ? undefined : "none",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      )}

      {q.question_type === "GROUP" && q.children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {q.children.map((child, ci) => (
            <div key={child.snapshot_id} style={{ paddingLeft: "20px", borderLeft: "3px solid rgba(3,72,82,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                  Part {ci + 1}
                </p>
                {renderReportButton?.(child.snapshot_id)}
              </div>
              <QuestionView
                q={child as QuizAttemptQuestion}
                answers={answers}
                setAnswer={setAnswer}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
