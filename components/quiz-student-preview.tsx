"use client";

import { useEffect, useState } from "react";
import type { Quiz, Question, QuizAttemptQuestion } from "@/lib/api";
import { QuestionView, type AnswerMap } from "@/components/question-view";

// ── Data conversion ───────────────────────────────────────────────────────────

function toAttemptQ(q: Question, sectionId?: string): QuizAttemptQuestion {
  return {
    snapshot_id: q.id,
    section_id: sectionId ?? null,
    question_type: q.question_type,
    content_html: q.content_html,
    instruction_html: q.instruction_html ?? null,
    tolerance: q.tolerance,
    image_url: q.image_url ?? null,
    options: q.options.map((o) => ({ id: o.id, option_text: o.option_text })),
    children: (q.children ?? []).map((c) => toAttemptQ(c, sectionId)),
  };
}

type PreviewSection = {
  id: string;
  title: string;
  questions: QuizAttemptQuestion[];
};

function buildSections(quiz: Quiz): PreviewSection[] {
  if (quiz.is_sectioned && quiz.sections.length > 0) {
    return quiz.sections.map((s) => ({
      id: s.id,
      title: s.title,
      questions: s.questions.map((q) => toAttemptQ(q, s.id)),
    }));
  }
  return [{ id: "__all__", title: "All Questions", questions: quiz.questions.map((q) => toAttemptQ(q)) }];
}

// ── Shared styles (mirrored from the real quiz page) ──────────────────────────

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 2px 24px rgba(3,72,82,0.08)",
  marginBottom: "20px",
};

const primaryBtn: React.CSSProperties = {
  background: "rgba(3,72,82,0.08)",
  color: "#034852",
  border: "none",
  borderRadius: "12px",
  padding: "12px 28px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "rgba(3,72,82,0.08)",
  color: "#034852",
  border: "none",
  borderRadius: "12px",
  padding: "12px 28px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const pill: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(10,190,98,0.1)",
  color: "#0abe62",
  borderRadius: "9999px",
  padding: "3px 12px",
  fontSize: "12px",
  fontWeight: 700,
};

// ── Component ─────────────────────────────────────────────────────────────────

export function QuizStudentPreview({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const isSectioned = quiz.is_sectioned && quiz.sections.length > 0;
  const sections = buildSections(quiz);

  // Flatten all questions in order (same as real quiz: attempt.questions)
  const allQuestions: QuizAttemptQuestion[] = sections.flatMap((s) => s.questions);
  const total = allQuestions.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());

  const safeIdx = Math.min(currentIdx, total - 1);
  const q = allQuestions[safeIdx];
  const isFirst = safeIdx === 0;
  const isLast = safeIdx === total - 1;
  const isFlagged = q ? flagged.has(q.snapshot_id) : false;

  // Section tab state: derive from current question's section_id
  const currentSectionId = q?.section_id ?? null;

  function setAnswer(snapshotId: string, val: string | null) {
    setAnswers((prev) => ({ ...prev, [snapshotId]: val }));
  }

  function toggleFlag(snapshotId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(snapshotId)) next.delete(snapshotId);
      else next.add(snapshotId);
      return next;
    });
  }

  function getQuestionStatus(i: number): "answered" | "flagged" | "flagged-answered" | "unanswered" {
    const qi = allQuestions[i];
    const answered =
      answers[qi.snapshot_id] != null ||
      (qi.question_type === "GROUP" && qi.children.some((c) => answers[c.snapshot_id] != null));
    const fl = flagged.has(qi.snapshot_id);
    if (fl && answered) return "flagged-answered";
    if (fl) return "flagged";
    if (answered) return "answered";
    return "unanswered";
  }

  const answered = allQuestions.filter((_, i) => getQuestionStatus(i) === "answered" || getQuestionStatus(i) === "flagged-answered").length;
  const flaggedCount = allQuestions.filter((_, i) => getQuestionStatus(i) === "flagged" || getQuestionStatus(i) === "flagged-answered").length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!q) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "#f0f2f5",
      fontFamily: "'Inter', sans-serif",
      color: "#034852",
      overflowY: "auto",
    }}>
      {/* ── Preview banner (not part of real quiz) ──────── */}
      <div style={{
        background: "#034852", padding: "0 24px", height: "40px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "3px 10px", borderRadius: "100px",
          background: "rgba(255,222,0,0.18)", border: "1px solid rgba(255,222,0,0.4)",
          color: "#ffe566", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em",
        }}>
          PREVIEW MODE — answers are not saved or graded
        </span>
        <button
          onClick={onClose}
          style={{
            padding: "4px 14px", borderRadius: "6px",
            border: "1.5px solid rgba(255,255,255,0.25)",
            background: "transparent", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer",
          }}
        >
          ✕ Exit Preview
        </button>
      </div>

      {/* ── Main content (matches real quiz layout) ─────── */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 20px" }}>
        {/* Header — matches real quiz */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#034852", margin: 0 }}>{quiz.title}</p>
          <span style={{ ...pill, background: "rgba(3,72,82,0.08)", color: "#034852" }}>Preview</span>
        </div>

        {/* Section tabs — identical style to real quiz */}
        {isSectioned && sections.length > 0 && (
          <div style={{
            display: "flex", gap: "4px", marginBottom: "16px",
            borderBottom: "2px solid rgba(3,72,82,0.08)", flexWrap: "wrap",
          }}>
            {sections.map((s) => {
              const isActive = currentSectionId === s.id || (currentSectionId == null && sections[0].id === s.id);
              const sAnswered = s.questions.filter((sq) => answers[sq.snapshot_id] != null).length;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    const firstIdx = allQuestions.findIndex((aq) => aq.section_id === s.id);
                    if (firstIdx >= 0) setCurrentIdx(firstIdx);
                  }}
                  style={{
                    padding: "10px 18px", fontSize: "14px", fontWeight: 700,
                    background: isActive ? "#fff" : "transparent",
                    color: isActive ? "#0abe62" : "#034852",
                    borderBottom: `3px solid ${isActive ? "#0abe62" : "transparent"}`,
                    marginBottom: "-2px", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "8px",
                  }}
                >
                  <span>{s.title}</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, opacity: 0.75 }}>
                    {sAnswered}/{s.questions.length}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Two-column layout — identical to real quiz */}
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
          {/* Main question card */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={card}>
              {/* Question header — identical to real quiz */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#034852" }}>
                  Question {safeIdx + 1} of {total}
                </p>
                <button
                  onClick={() => toggleFlag(q.snapshot_id)}
                  style={{
                    background: isFlagged ? "rgba(229,62,62,0.1)" : "rgba(3,72,82,0.06)",
                    color: isFlagged ? "#e53e3e" : "rgba(3,72,82,0.5)",
                    border: "none", borderRadius: "8px",
                    padding: "6px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  ⚑ {isFlagged ? "Flagged" : "Flag"}
                </button>
              </div>

              {/* Question body — identical QuestionView call */}
              <QuestionView q={q} answers={answers} setAnswer={setAnswer} />

              {/* Navigation — identical layout to real quiz, Submit replaced with non-functional label */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: "32px", paddingTop: "20px", borderTop: "1px solid rgba(3,72,82,0.08)",
              }}>
                <button
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={isFirst}
                  style={{ ...secondaryBtn, opacity: isFirst ? 0.3 : 1, cursor: isFirst ? "default" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  ‹ Previous
                </button>

                {isLast ? (
                  <button
                    disabled
                    style={{ ...primaryBtn, background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.35)", cursor: "default" }}
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                    style={{ ...primaryBtn, background: "linear-gradient(135deg,#0abe62,#209379)", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    Next ›
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar — identical to real quiz */}
          <div style={{ width: "220px", flexShrink: 0 }}>
            <div style={{ ...card, padding: "20px", marginBottom: "12px" }}>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
                {([
                  ["Answered", answered],
                  ["Unanswered", total - answered],
                  ["Flagged", flaggedCount],
                ] as const).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "20px", fontWeight: 800, lineHeight: 1, color: "#034852" }}>{value}</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(3,72,82,0.55)" }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Question grid — identical 4-column grid with same colour logic */}
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#034852", margin: "0 0 12px" }}>Questions</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {allQuestions.map((qi, i) => {
                  const status = getQuestionStatus(i);
                  const isCurrent = i === safeIdx;
                  const bg =
                    isCurrent        ? "#0abe62"                  :
                    status === "flagged-answered" ? "#ffd700"     :
                    status === "flagged"          ? "rgba(229,62,62,0.12)" :
                    status === "answered"         ? "rgba(10,190,98,0.12)" :
                    "transparent";
                  const color =
                    isCurrent        ? "#fff"                     :
                    status === "flagged-answered" ? "#6b5200"     :
                    status === "flagged"          ? "#e53e3e"      :
                    status === "answered"         ? "#0a8c4a"      :
                    "rgba(3,72,82,0.7)";
                  const border =
                    isCurrent        ? "2px solid #0abe62"        :
                    status === "flagged-answered" ? "2px solid #ffd700"   :
                    status === "flagged"          ? "1.5px solid rgba(229,62,62,0.4)" :
                    status === "answered"         ? "2px solid rgba(10,190,98,0.4)"  :
                    "1.5px solid rgba(3,72,82,0.15)";
                  return (
                    <button
                      key={qi.snapshot_id}
                      onClick={() => setCurrentIdx(i)}
                      style={{
                        aspectRatio: "1",
                        border,
                        borderRadius: "8px",
                        background: bg,
                        color,
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 120ms ease",
                        padding: 0,
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
