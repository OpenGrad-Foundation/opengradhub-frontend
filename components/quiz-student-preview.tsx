"use client";

import { useEffect, useState } from "react";
import type { Quiz, Question, QuizAttemptQuestion } from "@/lib/api";
import type { AttemptReviewQuestion } from "@/lib/api";
import { QuestionView, type AnswerMap } from "@/components/question-view";
import { PassageCard, QuestionReviewCard } from "@/components/question-review-card";

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

function toReviewQ(q: Question, answers: AnswerMap, parentQ?: Question): AttemptReviewQuestion {
  const studentAns = answers[q.id] ?? null;
  let isCorrect: boolean | null = null;
  if (q.question_type === "MCQ") {
     isCorrect = studentAns ? (q.options.find(o => o.id === studentAns)?.is_correct ?? false) : false;
  } else if (q.question_type === "NUMERICAL" || q.question_type === "FILL") {
     isCorrect = studentAns?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase();
  }

  return {
    snapshot_id: q.id,
    section_id: null,
    question_type: q.question_type,
    content_html: q.content_html,
    image_url: q.image_url ?? null,
    parent_snapshot_id: parentQ?.id ?? null,
    parent_content_html: parentQ?.content_html ?? null,
    parent_image_url: parentQ?.image_url ?? null,
    student_answer: studentAns,
    correct_answer: q.correct_answer ?? null,
    is_correct: isCorrect,
    marks_awarded: isCorrect ? (q.marks ?? 1) : 0,
    time_taken_seconds: 45,
    explanation_video_url: q.explanation_video_url ?? null,
    options: q.options.map(o => ({ id: o.id, option_text: o.option_text, is_correct: !!o.is_correct })),
    avg_time_seconds: 60,
    batch_correct_count: 75,
    batch_total_count: 100,
    solution_html: q.solution ?? null,
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
  const [mode, setMode] = useState<"TAKING" | "REVIEW">("TAKING");
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

  if (mode === "REVIEW") {
    const reviewQs: AttemptReviewQuestion[] = [];
    const originalQuestions = isSectioned ? quiz.sections.flatMap(s => s.questions) : quiz.questions;
    
    originalQuestions.forEach(qItem => {
      if (qItem.question_type === "GROUP") {
        qItem.children?.forEach(child => reviewQs.push(toReviewQ(child, answers, qItem)));
      } else {
        reviewQs.push(toReviewQ(qItem, answers));
      }
    });

    const correct = reviewQs.filter(rq => rq.is_correct === true).length;
    const totalMarks = reviewQs.length;
    const seenParents = new Set<string>();
    
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#f0f2f5", fontFamily: "'Inter', sans-serif", color: "#034852", overflowY: "auto" }}>
        <div style={{ background: "#034852", padding: "0 24px", height: "40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "100px", background: "rgba(255,222,0,0.18)", border: "1px solid rgba(255,222,0,0.4)", color: "#ffe566", fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em" }}>
            PREVIEW MODE — Review Page
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setMode("TAKING")} style={{ padding: "4px 14px", borderRadius: "6px", border: "1.5px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
              Back to Quiz
            </button>
            <button onClick={onClose} style={{ padding: "4px 14px", borderRadius: "6px", border: "1.5px solid rgba(255,255,255,0.25)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
              ✕ Exit Preview
            </button>
          </div>
        </div>

        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: "16px", padding: "28px 32px", boxShadow: "0 2px 24px rgba(3,72,82,0.08)", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 16px" }}>Quiz Results (Mock)</h2>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.5)" }}>Score</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#0abe62" }}>{correct} / {totalMarks}</p>
              </div>
            </div>
          </div>
          
          <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "32px 0 16px", color: "#034852" }}>Detailed Review</h3>
          {reviewQs.map((rq, idx) => {
            const hasParent = rq.parent_snapshot_id != null;
            const isFirstOfParent = hasParent && !seenParents.has(rq.parent_snapshot_id!);
            if (isFirstOfParent) seenParents.add(rq.parent_snapshot_id!);

            return (
              <div key={rq.snapshot_id}>
                {isFirstOfParent && (
                  <PassageCard html={rq.parent_content_html ?? ""} imageUrl={rq.parent_image_url ?? null} />
                )}
                <QuestionReviewCard q={rq} idx={idx} revealed={true} questionLabel={`Q${idx + 1}`} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
          <div className="hide-scrollbar" style={{
            display: "flex", gap: "4px", marginBottom: "16px",
            borderBottom: "2px solid rgba(3,72,82,0.08)", overflowX: "auto", whiteSpace: "nowrap", paddingBottom: "4px",
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
                    display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0,
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
        <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Main question card */}
          <div style={{ flex: "1 1 400px", minWidth: 0, maxWidth: "100%" }}>
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
                  ⚑ {isFlagged ? "Marked for Review" : "Mark for Review"}
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
                    onClick={() => setMode("REVIEW")}
                    style={{ ...primaryBtn, background: "rgba(3,72,82,0.9)", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}
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
          <div style={{ flex: "1 1 220px", maxWidth: "100%" }}>
            <div style={{ ...card, padding: "20px", marginBottom: "12px" }}>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
                {([
                  ["Answered", answered],
                  ["Unanswered", total - answered],
                  ["Marked for Review", flaggedCount],
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
                        height: "40px",
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
