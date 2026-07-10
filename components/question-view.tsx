"use client";

import { MathContent } from "@/app/dashboard/_components/MathContent";
import { type QuizAttemptQuestion } from "@/lib/api";

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
}: {
  q: QuizAttemptQuestion;
  answers: AnswerMap;
  setAnswer: (snapshotId: string, val: string | null) => void;
}) {
  const current = answers[q.snapshot_id] ?? null;

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
        <div>
          {q.options.map((opt) => {
            const selected = current === opt.id;
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
          placeholder={q.question_type === "NUMERICAL" ? "Enter a number…" : "Type your answer…"}
          value={current ?? ""}
          onChange={(e) => setAnswer(q.snapshot_id, e.target.value || null)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1.5px solid rgba(3,72,82,0.2)",
            fontSize: "15px",
            color: "#034852",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {q.question_type === "ESSAY" && (
        <textarea
          placeholder="Type your essay answer here…"
          value={current ?? ""}
          onChange={(e) => setAnswer(q.snapshot_id, e.target.value || null)}
          rows={6}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1.5px solid rgba(3,72,82,0.2)",
            fontSize: "15px",
            color: "#034852",
            outline: "none",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      )}

      {q.question_type === "GROUP" && q.children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {q.children.map((child, ci) => (
            <div key={child.snapshot_id} style={{ paddingLeft: "20px", borderLeft: "3px solid rgba(3,72,82,0.1)" }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.4)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Part {ci + 1}
              </p>
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
