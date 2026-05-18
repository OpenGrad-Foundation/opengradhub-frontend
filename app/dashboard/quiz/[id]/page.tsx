"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getQuizById,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizAttempts,
  type Quiz,
  type StartedAttempt,
  type QuizAttempt,
  type QuizAttemptQuestion,
} from "@/lib/api";
import { MathContent } from "@/app/dashboard/_components/MathContent";

// ── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  maxWidth: "760px",
  margin: "0 auto",
  padding: "32px 16px",
  fontFamily: "'Inter', sans-serif",
  color: "#034852",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 2px 24px rgba(3,72,82,0.08)",
  marginBottom: "20px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#034852",
  margin: "0 0 8px",
};

const subtext: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const pill: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(10,190,98,0.1)",
  color: "#0abe62",
  borderRadius: "9999px",
  padding: "3px 12px",
  fontSize: "12px",
  fontWeight: 700,
  marginRight: "8px",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg,#0abe62,#209379)",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 28px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "20px",
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
  marginTop: "20px",
  marginLeft: "12px",
};

const optionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 14px",
  borderRadius: "10px",
  marginBottom: "8px",
  cursor: "pointer",
  border: "1.5px solid rgba(3,72,82,0.12)",
  transition: "all 0.15s",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type AnswerMap = Record<string, string | null>; // snapshot_id → student_answer (option id or text)
type TimingMap = Record<string, number>;         // snapshot_id → accumulated seconds

type ResultState = {
  attempt_id: string;
  score: number;
  max_score: number;
  passed: boolean | null;
  show_answers_after: boolean;
};

// ── Question renderer ─────────────────────────────────────────────────────────

function QuestionBlock({
  q,
  idx,
  answers,
  setAnswer,
  onEnter,
  onLeave,
}: {
  q: QuizAttemptQuestion;
  idx: number;
  answers: AnswerMap;
  setAnswer: (snapshotId: string, val: string | null) => void;
  onEnter: (snapshotId: string) => void;
  onLeave: (snapshotId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onEnter(q.snapshot_id);
        else onLeave(q.snapshot_id);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [q.snapshot_id, onEnter, onLeave]);
  const current = answers[q.snapshot_id] ?? null;

  return (
    <div ref={containerRef} style={{ marginBottom: "32px" }}>
      <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(3,72,82,0.4)", marginBottom: "6px" }}>
        Q{idx + 1} · {q.question_type === "MCQ" ? "Multiple Choice" : q.question_type === "NUMERIC" ? "Numeric" : "Short Answer"}
      </p>
      {/* Question content — renders $...$ and $$...$$ as KaTeX math */}
      <MathContent
        html={q.content_html}
        style={{ fontSize: "16px", fontWeight: 600, lineHeight: 1.5, marginBottom: "16px" }}
      />

      {q.question_type === "MCQ" && q.options.length > 0 && (
        <div>
          {q.options.map((opt) => {
            const selected = current === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setAnswer(q.snapshot_id, opt.id)}
                style={{
                  ...optionRow,
                  background: selected ? "rgba(10,190,98,0.12)" : "transparent",
                  borderColor: selected ? "#0abe62" : "rgba(3,72,82,0.12)",
                }}
              >
                <div style={{
                  width: "18px", height: "18px", borderRadius: "50%",
                  border: `2px solid ${selected ? "#0abe62" : "rgba(3,72,82,0.3)"}`,
                  background: selected ? "#0abe62" : "transparent",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: "15px" }}>{opt.option_text}</span>
              </div>
            );
          })}
        </div>
      )}

      {(q.question_type === "NUMERIC" || q.question_type === "SHORT_ANSWER") && (
        <input
          type={q.question_type === "NUMERIC" ? "number" : "text"}
          placeholder={q.question_type === "NUMERIC" ? "Enter a number…" : "Type your answer…"}
          value={current ?? ""}
          onChange={(e) => setAnswer(q.snapshot_id, e.target.value || null)}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1.5px solid rgba(3,72,82,0.2)",
            fontSize: "15px",
            color: "#034852",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      )}

      {/* GROUP children */}
      {q.question_type === "GROUP" && q.children.length > 0 && (
        <div style={{ paddingLeft: "20px", borderLeft: "3px solid rgba(3,72,82,0.1)", marginTop: "12px" }}>
          {q.children.map((child, ci) => (
            <QuestionBlock
              key={child.snapshot_id}
              q={child as QuizAttemptQuestion}
              idx={ci}
              answers={answers}
              setAnswer={setAnswer}
              onEnter={onEnter}
              onLeave={onLeave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizTakingPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: userData, isLoading: userLoading } = useCurrentUser();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<ResultState | null>(null);
  const [phase, setPhase] = useState<"loading" | "intro" | "taking" | "result" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [pastAttempts, setPastAttempts] = useState<QuizAttempt[]>([]);

  // Per-question timing via IntersectionObserver
  const timingsRef    = useRef<TimingMap>({});   // accumulated seconds per snapshot_id
  const enterTimesRef = useRef<TimingMap>({});    // timestamp when question entered viewport

  const handleQuestionEnter = useRef((snapshotId: string) => {
    enterTimesRef.current[snapshotId] = Date.now();
  }).current;

  const handleQuestionLeave = useRef((snapshotId: string) => {
    const entered = enterTimesRef.current[snapshotId];
    if (entered) {
      timingsRef.current[snapshotId] = (timingsRef.current[snapshotId] ?? 0) + Math.round((Date.now() - entered) / 1000);
      delete enterTimesRef.current[snapshotId];
    }
  }).current;

  useEffect(() => {
    if (userLoading || !userData) return;
    if (userData.role.code !== "STUDENT") {
      setError("Only students can take quizzes.");
      setPhase("error");
      return;
    }

    async function load() {
      try {
        const [q, attempts] = await Promise.all([
          getQuizById(quizId),
          getQuizAttempts(quizId),
        ]);
        setQuiz(q);
        const completed = attempts.filter((a) => a.is_complete);
        setAttemptsUsed(completed.length);
        setPastAttempts(completed);
        setPhase("intro");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quiz.");
        setPhase("error");
      }
    }
    void load();
  }, [userLoading, userData, quizId]);

  async function handleStart() {
    try {
      setPhase("loading");
      const started = await startQuizAttempt(quizId);
      setAttempt(started);
      setAnswers({});
      setPhase("taking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start attempt.");
      setPhase("error");
    }
  }

  async function handleSubmit() {
    if (!attempt) return;
    setSubmitting(true);
    try {
      // Flush any questions still in viewport before submitting
      const now = Date.now();
      for (const [snapshotId, entered] of Object.entries(enterTimesRef.current)) {
        timingsRef.current[snapshotId] = (timingsRef.current[snapshotId] ?? 0) + Math.round((now - entered) / 1000);
      }
      enterTimesRef.current = {};

      const answerList = Object.entries(answers).map(([snapshot_id, student_answer]) => ({
        snapshot_id,
        student_answer,
        time_taken_seconds: timingsRef.current[snapshot_id] ?? null,
      }));
      const res = await submitQuizAttempt(attempt.attempt_id, answerList);
      setResult({
        attempt_id: res.attempt_id,
        score: res.score,
        max_score: res.max_score,
        passed: res.passed,
        show_answers_after: quiz?.show_answers_after ?? false,
      });
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz.");
      setPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  function setAnswer(snapshotId: string, val: string | null) {
    setAnswers((prev) => ({ ...prev, [snapshotId]: val }));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "loading" || userLoading) {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <p style={subtext}>Loading…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div style={page}>
        <div style={card}>
          <p style={{ ...heading, color: "#e53e3e" }}>Error</p>
          <p style={subtext}>{error}</p>
          <button onClick={() => router.back()} style={primaryBtn}>Go back</button>
        </div>
      </div>
    );
  }

  if (phase === "intro" && quiz) {
    const exhausted = quiz.max_attempts != null && attemptsUsed >= quiz.max_attempts;
    return (
      <div style={page}>
        <a
          href="/dashboard/assessments"
          style={{ fontSize: "13px", color: "#209379", fontWeight: 600, textDecoration: "none", display: "block", marginBottom: "20px" }}
        >
          ← Back to Assessments
        </a>
        <div style={card}>
          <p style={{ ...subtext, marginBottom: "6px" }}>
            {quiz.quiz_type === "MODULE_TEST" ? "Module Test" : "Global Test"}
          </p>
          <h1 style={heading}>{quiz.title}</h1>
          <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {quiz.duration_minutes && <span style={pill}>⏱ {quiz.duration_minutes} min</span>}
            {quiz.max_attempts && (
              <span style={pill}>
                {attemptsUsed}/{quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? "s" : ""} used
              </span>
            )}
            {quiz.pass_threshold_percent && (
              <span style={pill}>Pass: {quiz.pass_threshold_percent}%</span>
            )}
            <span style={pill}>{quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}</span>
          </div>
          {exhausted ? (
            <p style={{ ...subtext, marginTop: "20px", color: "#e53e3e" }}>
              You have used all available attempts for this quiz.
            </p>
          ) : (
            <button onClick={handleStart} style={{ ...primaryBtn, marginTop: "20px" }}>
              {attemptsUsed > 0 ? "Retake Quiz" : "Start Quiz"} →
            </button>
          )}

          {/* Past attempt history */}
          {pastAttempts.length > 0 && (
            <div style={{ marginTop: "28px", borderTop: "1px solid rgba(3,72,82,0.08)", paddingTop: "20px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(3,72,82,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                Past Attempts
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pastAttempts.map((a) => {
                  const pct = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null;
                  const date = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "rgba(3,72,82,0.03)", borderRadius: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852" }}>
                          Attempt {a.attempt_number} — {a.score ?? "?"}/{a.max_score ?? "?"}{pct !== null ? ` (${pct}%)` : ""}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>{date}</p>
                      </div>
                      {a.passed !== null && (
                        <span style={{ fontSize: "12px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", background: a.passed ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.1)", color: a.passed ? "#0abe62" : "#e53e3e" }}>
                          {a.passed ? "Passed" : "Failed"}
                        </span>
                      )}
                      {quiz?.show_answers_after && (
                        <button
                          onClick={() => router.push(`/dashboard/quiz/${quizId}/review/${a.id}`)}
                          style={{ ...secondaryBtn, padding: "6px 14px", fontSize: "13px", margin: 0 }}
                        >
                          Review →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "taking" && attempt) {
    return (
      <div style={page}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <p style={{ fontSize: "14px", fontWeight: 700, color: "#034852" }}>{quiz?.title}</p>
          <span style={{ ...pill, background: "rgba(3,72,82,0.08)", color: "#034852" }}>
            Attempt #{attempt.attempt_number}
          </span>
        </div>

        <div style={card}>
          {attempt.questions.map((q, i) => (
            <QuestionBlock
              key={q.snapshot_id}
              q={q}
              idx={i}
              answers={answers}
              setAnswer={setAnswer}
              onEnter={handleQuestionEnter}
              onLeave={handleQuestionLeave}
            />
          ))}

          <div style={{ borderTop: "1px solid rgba(3,72,82,0.1)", paddingTop: "20px", marginTop: "8px" }}>
            <button onClick={handleSubmit} disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Submitting…" : "Submit Quiz"}
            </button>
            <button
              onClick={() => { if (confirm("Discard this attempt?")) setPhase("intro"); }}
              style={secondaryBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const pct = result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : null;
    return (
      <div style={page}>
        <div style={card}>
          <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
            Quiz Complete
          </p>
          <h1 style={{ ...heading, fontSize: "28px" }}>{quiz?.title}</h1>

          <div style={{ marginTop: "28px", padding: "24px", background: "rgba(3,72,82,0.04)", borderRadius: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "48px", fontWeight: 900, color: "#034852", margin: 0 }}>
              {result.score}/{result.max_score}
            </p>
            {pct !== null && (
              <p style={{ fontSize: "20px", color: "rgba(3,72,82,0.6)", margin: "4px 0 0" }}>{pct}%</p>
            )}
            {result.passed !== null && (
              <p style={{
                fontSize: "18px", fontWeight: 800, marginTop: "12px",
                color: result.passed ? "#0abe62" : "#e53e3e",
              }}>
                {result.passed ? "Passed" : "Not Passed"}
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/dashboard/assessments")} style={primaryBtn}>
              Back to Assessments
            </button>
            {result.show_answers_after && (
              <button
                onClick={() => router.push(`/dashboard/quiz/${quizId}/review/${result.attempt_id}`)}
                style={secondaryBtn}
              >
                Review Answers →
              </button>
            )}
            {userData?.user?.programme === "PG" && (
              <button
                onClick={() => router.push(`/dashboard/quiz/${quizId}/leaderboard`)}
                style={secondaryBtn}
              >
                Leaderboard
              </button>
            )}
            {quiz?.max_attempts == null || attemptsUsed + 1 < (quiz?.max_attempts ?? Infinity) ? (
              <button onClick={() => { setAttemptsUsed((n) => n + 1); setPhase("intro"); }} style={secondaryBtn}>
                Retake Quiz
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
