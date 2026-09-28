"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
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
    instruction_html: q.instruction_html ?? null,
    image_url: q.image_url ?? null,
    parent_snapshot_id: parentQ?.id ?? null,
    parent_content_html: parentQ?.content_html ?? null,
    parent_instruction_html: parentQ?.instruction_html ?? null,
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
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px, 4vw, 24px)",
  marginBottom: "20px",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "44px",
  background: "var(--green)",
  color: "var(--dark-teal)",
  border: "1px solid var(--green)",
  borderRadius: "12px",
  padding: "8px 20px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "var(--color-surface-sunken)",
  color: "var(--color-text)",
  borderRadius: "6px",
  padding: "3px 8px",
  fontSize: "12px",
  fontWeight: 600,
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
      <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "var(--color-background)", color: "var(--color-text)", overflowY: "auto" }}>
        <div style={{ background: "var(--dark-teal)", padding: "0 24px", height: "40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
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
          <div style={card}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 16px" }}>Quiz results (mock)</h2>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)" }}>Score</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#08784a" }}>{correct} / {totalMarks}</p>
              </div>
            </div>
          </div>
          
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "32px 0 16px", color: "var(--color-text)" }}>Detailed review</h3>
          {reviewQs.map((rq, idx) => {
            const hasParent = rq.parent_snapshot_id != null;
            const isFirstOfParent = hasParent && !seenParents.has(rq.parent_snapshot_id!);
            if (isFirstOfParent) seenParents.add(rq.parent_snapshot_id!);

            return (
              <div key={rq.snapshot_id}>
                {isFirstOfParent && (
                  <PassageCard html={rq.parent_content_html ?? ""} imageUrl={rq.parent_image_url ?? null} instructionHtml={rq.parent_instruction_html ?? null} />
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
      background: "var(--color-background)",
      color: "var(--color-text)",
      overflowY: "auto",
    }}>
      {/* ── Preview banner (not part of real quiz) ──────── */}
      <div style={{
        background: "var(--dark-teal)", padding: "0 24px", height: "40px",
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{quiz.title}</p>
          <span style={pill}>Preview</span>
        </div>

        {/* Section tabs — identical style to real quiz */}
        {isSectioned && sections.length > 0 && (
          <div className="hide-scrollbar" style={{
            display: "flex", gap: "4px", marginBottom: "16px",
            borderBottom: "2px solid var(--color-border)", overflowX: "auto", whiteSpace: "nowrap", paddingBottom: "4px",
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
                    padding: "10px 18px", fontSize: "14px", fontWeight: 600,
                    background: isActive ? "var(--color-surface)" : "transparent",
                    color: isActive ? "#08784a" : "var(--color-text)",
                    borderBottom: `3px solid ${isActive ? "var(--green)" : "transparent"}`,
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
        <div className="flex flex-col-reverse lg:flex-row gap-5 items-start">
          {/* Main question card */}
          <div className="flex-1 min-w-0 w-full">
            <div style={card}>
              {/* Question header — identical to real quiz */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
                <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-text)" }}>
                  Question {safeIdx + 1} of {total}
                </p>
                <button
                  onClick={() => toggleFlag(q.snapshot_id)}
                  style={{
                    background: isFlagged ? "rgba(184,50,50,0.1)" : "var(--color-surface)",
                    color: isFlagged ? "#b83232" : "var(--color-text-muted)",
                    border: `1px solid ${isFlagged ? "rgba(184,50,50,0.3)" : "var(--color-border)"}`,
                    borderRadius: "8px", minHeight: "36px",
                    padding: "6px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <Flag size={14} aria-hidden="true" />{isFlagged ? "Marked for Review" : "Mark for Review"}
                </button>
              </div>

              {/* Question body — identical QuestionView call */}
              <QuestionView q={q} answers={answers} setAnswer={setAnswer} />

              {/* Navigation — identical layout to real quiz, Submit replaced with non-functional label */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginTop: "32px", paddingTop: "20px", borderTop: "1px solid var(--color-border)",
              }}>
                <button
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={isFirst}
                  style={{ ...secondaryBtn, opacity: isFirst ? 0.3 : 1, cursor: isFirst ? "default" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <ChevronLeft size={16} aria-hidden="true" />Previous
                </button>

                {isLast ? (
                  <button
                    onClick={() => setMode("REVIEW")}
                    style={primaryBtn}
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                    style={primaryBtn}
                  >
                    Next <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar — identical to real quiz */}
          <div className="w-full lg:w-[220px] shrink-0">
            <div style={{ ...card, padding: "20px", marginBottom: "12px" }}>
              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--color-border)" }}>
                {([
                  ["Answered", answered],
                  ["Unanswered", total - answered],
                  ["Marked for Review", flaggedCount],
                ] as const).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1, color: "var(--color-text)" }}>{value}</span>
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)" }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Question grid — identical 4-column grid with same colour logic */}
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", margin: "0 0 12px" }}>Questions</p>
              <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-4 gap-2">
                {allQuestions.map((qi, i) => {
                  const status = getQuestionStatus(i);
                  const isCurrent = i === safeIdx;
                  const isQFlagged = status === "flagged" || status === "flagged-answered";
                  const isAnswered = status === "answered" || status === "flagged-answered";
                  return (
                    <button
                      key={qi.snapshot_id}
                      onClick={() => setCurrentIdx(i)}
                      style={{
                        width: "100%",
                        height: "40px",
                        borderRadius: "8px",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        position: "relative",
                        padding: 0,
                        background: isCurrent ? "var(--dark-teal)" : isAnswered ? "rgba(10,190,98,0.15)" : "var(--color-surface-sunken)",
                        color: isCurrent ? "#fff" : isAnswered ? "#08784a" : "var(--color-text-muted)",
                        outline: isQFlagged ? "2px solid #b83232" : "none",
                        outlineOffset: "2px",
                      }}
                    >
                      {i + 1}
                      {isQFlagged && (
                        <Flag size={9} aria-hidden="true" style={{ position: "absolute", top: "3px", right: "3px", color: "#b83232" }} />
                      )}
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
