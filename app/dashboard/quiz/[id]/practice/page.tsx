"use client";

// Client-side practice retake page. Pulls the one-time practice payload from
// IndexedDB (or fetches & caches it on first run), lets the student answer at
// their own pace, autosaves progress for refresh-resume, and grades locally on
// submit. Nothing here is ever recorded server-side — practice scores are not
// authoritative.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QuestionView, type AnswerMap } from "@/components/question-view";
import { ApiError, getPracticePayload, type QuizAttemptQuestion } from "@/lib/api";
import {
  clearProgress,
  getPayload,
  getProgress,
  savePayload,
  saveProgress,
  type PracticeAnswers,
  type PracticePayload,
  type PracticePayloadQuestion,
} from "@/lib/practiceStore";
import { gradePractice, type GradableQuestion, type PracticeVerdict } from "@/lib/practiceGrader";
import { MathContent } from "@/app/dashboard/_components/MathContent";

// ── Type mapper ───────────────────────────────────────────────────────────────
// QuizAttemptQuestion (from @/lib/api) is what <QuestionView/> expects:
//   { snapshot_id, section_id?, question_type, content_html,
//     correct_answer, tolerance,
//     options: { id, option_text }[],       // ← no is_correct
//     children: { …same as parent minus children }[] }
//
// The practice payload carries `is_correct` on each option (so we can grade
// locally) plus deeper-nested `children`. The QuizAttemptQuestion `children`
// type only allows ONE level of nesting, so when we recurse we strip the
// grandchildren array on the way down (group-in-group isn't a real thing in
// the schema today, but the cast keeps us future-proof).
function toQuizQuestion(p: PracticePayloadQuestion): QuizAttemptQuestion {
  return {
    snapshot_id: p.snapshot_id,
    section_id: p.section_id,
    question_type: p.question_type,
    content_html: p.content_html,
    correct_answer: p.correct_answer,
    tolerance: p.tolerance,
    options: (p.options ?? []).map((o) => ({ id: o.id, option_text: o.option_text })),
    children: (p.children ?? []).map((c) => ({
      snapshot_id: c.snapshot_id,
      section_id: c.section_id,
      question_type: c.question_type,
      content_html: c.content_html,
      correct_answer: c.correct_answer,
      tolerance: c.tolerance,
      options: (c.options ?? []).map((o) => ({ id: o.id, option_text: o.option_text })),
    })),
  };
}

// gradePractice needs the raw is_correct flags. Build a leaf-only gradable
// view straight from the payload (parent GROUPs are never graded).
function toGradable(p: PracticePayloadQuestion): GradableQuestion {
  return {
    question_type: p.question_type,
    correct_answer: p.correct_answer,
    tolerance: p.tolerance,
    options: p.options.map((o) => ({ id: o.id, is_correct: o.is_correct })),
  };
}

// Flatten the payload tree into the leaf questions that should be graded.
function leafQuestions(qs: PracticePayloadQuestion[]): PracticePayloadQuestion[] {
  const out: PracticePayloadQuestion[] = [];
  const walk = (q: PracticePayloadQuestion) => {
    if (q.question_type === "GROUP") {
      (q.children ?? []).forEach(walk);
    } else {
      out.push(q);
    }
  };
  qs.forEach(walk);
  return out;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageOuter: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f0f2f5",
  fontFamily: "'Inter', sans-serif",
  color: "#034852",
};

const pageInner: React.CSSProperties = {
  maxWidth: "880px",
  margin: "0 auto",
  padding: "32px 20px 80px",
};

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "28px 32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 28px",
  border: "none",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "15px",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 20px",
  border: "1.5px solid rgba(3,72,82,0.15)",
  borderRadius: "10px",
  background: "#fff",
  color: "#034852",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
};

const eyebrow: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
  margin: "0 0 6px",
};

const heading: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "26px",
  fontWeight: 800,
  color: "#034852",
  margin: 0,
};

// ── Page ──────────────────────────────────────────────────────────────────────

type PageState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "answering"; payload: PracticePayload }
  | { kind: "results"; payload: PracticePayload };

export default function PracticePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params?.id ?? "";

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [answers, setAnswers] = useState<PracticeAnswers>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial load: hydrate payload + saved answers ───────────────────────
  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;

    (async () => {
      try {
        let payload = await getPayload(quizId);
        if (!payload) {
          payload = await getPracticePayload(quizId);
          await savePayload(payload);
        }
        if (cancelled) return;

        const saved = await getProgress(quizId);
        if (cancelled) return;

        setAnswers(saved ?? {});
        setState({ kind: "answering", payload });
      } catch (e) {
        if (cancelled) return;
        const message =
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Failed to load practice.";
        setState({ kind: "error", message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId]);

  // ── Debounced autosave ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.kind !== "answering") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProgress(quizId, answers);
    }, 500);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        // Flush the pending write so a fast navigation doesn't drop the last keystrokes.
        void saveProgress(quizId, answers);
      }
    };
  }, [answers, quizId, state.kind]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const setAnswer = (snapshotId: string, val: string | null) => {
    setAnswers((prev) => ({ ...prev, [snapshotId]: val }));
  };

  const handleSubmit = () => {
    if (state.kind !== "answering") return;
    // Flush any pending autosave so refresh-resume on results page works too.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void saveProgress(quizId, answers);
    setState({ kind: "results", payload: state.payload });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePracticeAgain = async () => {
    if (state.kind !== "results") return;
    await clearProgress(quizId);
    setAnswers({});
    setState({ kind: "answering", payload: state.payload });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (state.kind === "loading") {
    return (
      <div style={pageOuter}>
        <div style={pageInner}>
          <div style={{ ...glassCard, textAlign: "center" }}>
            <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px", margin: 0 }}>
              Loading practice…
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div style={pageOuter}>
        <div style={pageInner}>
          <div
            style={{
              ...glassCard,
              background: "rgba(229,62,62,0.07)",
              border: "1px solid rgba(229,62,62,0.2)",
            }}
          >
            <p style={eyebrow}>Practice unavailable</p>
            <h1 style={heading}>Practice is not available for this quiz</h1>
            <p style={{ fontSize: "15px", color: "rgba(3,72,82,0.7)", margin: "12px 0 24px", lineHeight: 1.6 }}>
              {state.message}
            </p>
            <Link
              href="/dashboard/assessments"
              style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}
            >
              ← Back to assessments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageOuter}>
      <div style={pageInner}>
        {/* Persistent "not recorded" banner */}
        <div
          style={{
            background: "rgba(217,119,6,0.08)",
            border: "1px solid rgba(217,119,6,0.25)",
            borderRadius: "12px",
            padding: "12px 18px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px" }}>●</span>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#92590a" }}>
            Practice run — not recorded.
          </p>
        </div>

        {/* Header card */}
        <div style={{ ...glassCard, marginBottom: "20px" }}>
          <p style={eyebrow}>Practice mode</p>
          <h1 style={heading}>{state.payload.quiz_title}</h1>
          <p
            style={{
              fontSize: "14px",
              color: "rgba(3,72,82,0.6)",
              margin: "10px 0 0",
              lineHeight: 1.6,
            }}
          >
            Take your time. No timer, no fullscreen. Your answers stay on this device
            until you submit, and even then nothing is sent to the server.
          </p>
        </div>

        {state.kind === "answering" ? (
          <AnsweringView
            payload={state.payload}
            answers={answers}
            setAnswer={setAnswer}
            onSubmit={handleSubmit}
            onBack={() => router.push("/dashboard/assessments")}
          />
        ) : (
          <ResultsView
            payload={state.payload}
            answers={answers}
            onPracticeAgain={handlePracticeAgain}
            onBack={() => router.push("/dashboard/assessments")}
          />
        )}
      </div>
    </div>
  );
}

// ── Answering view ────────────────────────────────────────────────────────────

function AnsweringView({
  payload,
  answers,
  setAnswer,
  onSubmit,
  onBack,
}: {
  payload: PracticePayload;
  answers: AnswerMap;
  setAnswer: (snapshotId: string, val: string | null) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <>
      {payload.questions.map((q, i) => (
        <div key={q.snapshot_id} style={{ ...glassCard, marginBottom: "20px" }}>
          <p
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#209379",
              margin: "0 0 14px",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Question {i + 1} of {payload.questions.length}
          </p>
          <QuestionView q={toQuizQuestion(q)} answers={answers} setAnswer={setAnswer} />
        </div>
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginTop: "32px",
          flexWrap: "wrap",
        }}
      >
        <button onClick={onBack} style={secondaryBtn}>
          ← Back to assessments
        </button>
        <button onClick={onSubmit} style={primaryBtn}>
          Submit practice →
        </button>
      </div>
    </>
  );
}

// ── Results view ──────────────────────────────────────────────────────────────

type GradedRow = {
  question: PracticePayloadQuestion;
  verdict: PracticeVerdict;
  studentAnswer: string | null;
  // The numeric index in the *leaf* list (1-based) — useful for display only.
  index: number;
};

function ResultsView({
  payload,
  answers,
  onPracticeAgain,
  onBack,
}: {
  payload: PracticePayload;
  answers: AnswerMap;
  onPracticeAgain: () => void;
  onBack: () => void;
}) {
  const graded = useMemo<GradedRow[]>(() => {
    const leaves = leafQuestions(payload.questions);
    return leaves.map((q, i) => {
      const studentAnswer = answers[q.snapshot_id] ?? null;
      return {
        question: q,
        verdict: gradePractice(toGradable(q), studentAnswer),
        studentAnswer,
        index: i + 1,
      };
    });
  }, [payload, answers]);

  const totalAwarded = graded.reduce((s, g) => s + g.verdict.marks_awarded, 0);
  const totalMax = graded.reduce((s, g) => s + g.verdict.max_marks, 0);
  const pct = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;
  const needsSelfCheck = graded.some((g) => g.verdict.is_correct === null);

  return (
    <>
      {/* Score summary */}
      <div style={{ ...glassCard, marginBottom: "20px", textAlign: "center" }}>
        <p style={eyebrow}>Practice result</p>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: "10px",
            margin: "8px 0 4px",
          }}
        >
          <span style={{ fontSize: "56px", fontWeight: 900, color: "#034852", lineHeight: 1 }}>
            {pct}%
          </span>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "rgba(3,72,82,0.5)" }}>
            {totalAwarded} / {totalMax} marks
          </span>
        </div>
        {needsSelfCheck && (
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", margin: "10px 0 0" }}>
            Short-answer questions are marked &ldquo;self-check&rdquo; — review the
            explanation below and judge for yourself.
          </p>
        )}
      </div>

      {/* Question-by-question feedback */}
      {payload.questions.map((q, i) => (
        <ResultQuestionCard
          key={q.snapshot_id}
          question={q}
          parentIndex={i + 1}
          totalParents={payload.questions.length}
          answers={answers}
        />
      ))}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginTop: "32px",
          flexWrap: "wrap",
        }}
      >
        <button onClick={onBack} style={secondaryBtn}>
          ← Back to assessments
        </button>
        <button onClick={onPracticeAgain} style={primaryBtn}>
          Practice again ↻
        </button>
      </div>
    </>
  );
}

function ResultQuestionCard({
  question,
  parentIndex,
  totalParents,
  answers,
}: {
  question: PracticePayloadQuestion;
  parentIndex: number;
  totalParents: number;
  answers: AnswerMap;
}) {
  const isGroup = question.question_type === "GROUP";

  return (
    <div style={{ ...glassCard, marginBottom: "20px" }}>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#209379",
          margin: "0 0 14px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Question {parentIndex} of {totalParents}
      </p>

      <MathContent
        html={question.content_html}
        style={{ fontSize: "16px", fontWeight: 600, lineHeight: 1.6, marginBottom: "16px" }}
      />

      {isGroup ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {question.children.map((child, ci) => (
            <div
              key={child.snapshot_id}
              style={{ paddingLeft: "20px", borderLeft: "3px solid rgba(3,72,82,0.1)" }}
            >
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "rgba(3,72,82,0.4)",
                  margin: "0 0 8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Part {ci + 1}
              </p>
              <LeafResult question={child} answers={answers} />
            </div>
          ))}
        </div>
      ) : (
        <LeafResult question={question} answers={answers} />
      )}
    </div>
  );
}

function LeafResult({
  question,
  answers,
}: {
  question: PracticePayloadQuestion;
  answers: AnswerMap;
}) {
  const studentAnswer = answers[question.snapshot_id] ?? null;
  const verdict = gradePractice(toGradable(question), studentAnswer);

  // ── Verdict pill ──
  let pillBg = "rgba(3,72,82,0.08)";
  let pillFg = "#034852";
  let pillLabel = "Self-check";
  if (verdict.is_correct === true) {
    pillBg = "rgba(10,190,98,0.12)";
    pillFg = "#0abe62";
    pillLabel = "Correct";
  } else if (verdict.is_correct === false) {
    pillBg = "rgba(229,62,62,0.1)";
    pillFg = "#c53030";
    pillLabel = "Incorrect";
  }

  // ── Student answer display ──
  const studentAnswerText = formatStudentAnswer(question, studentAnswer);
  const correctAnswerText = formatCorrectAnswer(question);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-block",
            borderRadius: "9999px",
            padding: "4px 12px",
            fontSize: "12px",
            fontWeight: 700,
            background: pillBg,
            color: pillFg,
          }}
        >
          {pillLabel}
        </span>
        <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)", fontWeight: 600 }}>
          {verdict.marks_awarded} / {verdict.max_marks} marks
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "8px",
          marginBottom: "12px",
          background: "rgba(3,72,82,0.03)",
          borderRadius: "10px",
          padding: "12px 16px",
        }}
      >
        <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.55)" }}>
          <strong style={{ fontWeight: 700, color: "#034852" }}>Your answer:</strong>{" "}
          <span style={{ color: studentAnswer ? "#034852" : "rgba(3,72,82,0.4)" }}>
            {studentAnswer ? studentAnswerText : "(no answer)"}
          </span>
        </p>
        {correctAnswerText !== null && (
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.55)" }}>
            <strong style={{ fontWeight: 700, color: "#034852" }}>Correct answer:</strong>{" "}
            <span style={{ color: "#0abe62", fontWeight: 600 }}>{correctAnswerText}</span>
          </p>
        )}
      </div>

      {question.explanation_html && (
        <div
          style={{
            background: "rgba(32,147,121,0.06)",
            border: "1px solid rgba(32,147,121,0.18)",
            borderRadius: "10px",
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#209379",
            }}
          >
            Explanation
          </p>
          <MathContent
            html={question.explanation_html}
            style={{ fontSize: "14px", lineHeight: 1.6, color: "#034852" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Display helpers ───────────────────────────────────────────────────────────

function formatStudentAnswer(q: PracticePayloadQuestion, ans: string | null): string {
  if (!ans) return "";
  if (q.question_type === "MCQ") {
    const match = q.options.find((o) => o.id === ans);
    return match ? match.option_text : ans;
  }
  return ans;
}

function formatCorrectAnswer(q: PracticePayloadQuestion): string | null {
  if (q.question_type === "MCQ") {
    const match = q.options.find((o) => o.is_correct);
    return match ? match.option_text : null;
  }
  if (q.question_type === "NUMERICAL") {
    if (!q.correct_answer) return null;
    return q.tolerance && q.tolerance > 0
      ? `${q.correct_answer} (±${q.tolerance})`
      : q.correct_answer;
  }
  // FILL / SHORT_ANSWER — no single canonical answer; explanation does the work.
  return null;
}
