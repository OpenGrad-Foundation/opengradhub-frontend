"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAttemptReview, type AttemptReview, type AttemptReviewQuestion, type AttemptReviewSection } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { MathContent } from "@/app/dashboard/_components/MathContent";

// ── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { maxWidth: "960px", margin: "0 auto", padding: "32px 16px", color: "#034852" };
const card: React.CSSProperties = { background: "rgba(255,255,255,0.85)", borderRadius: "16px", padding: "28px 32px", boxShadow: "0 2px 24px rgba(3,72,82,0.08)", marginBottom: "20px" };
const label: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 4px" };

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const isYouTube = u.hostname === "www.youtube.com" || u.hostname === "youtube.com" || u.hostname === "youtu.be";
    if (!isYouTube) return null;
    const v = u.hostname === "youtu.be"
      ? u.pathname.slice(1)
      : u.searchParams.get("v");
    if (!v || !/^[a-zA-Z0-9_-]{11}$/.test(v)) return null;
    return `https://www.youtube.com/embed/${v}`;
  } catch {
    return null;
  }
}

// ── Single question card ──────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function QuestionAnalyticsPanel({ q }: { q: AttemptReviewQuestion }) {
  const isManualGrading = q.question_type === "FILL";
  const correctPct = !isManualGrading && q.batch_total_count > 0
    ? Math.round((q.batch_correct_count / q.batch_total_count) * 100)
    : null;

  return (
    <div style={{
      width: "200px",
      flexShrink: 0,
      background: "rgba(3,72,82,0.03)",
      border: "1.5px solid rgba(3,72,82,0.09)",
      borderRadius: "12px",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    }}>
      <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "#209379" }}>Analytics</p>

      {/* My time */}
      <div>
        <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>My Time</p>
        <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#034852" }}>
          {q.time_taken_seconds != null ? formatSeconds(q.time_taken_seconds) : "—"}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(3,72,82,0.08)" }} />

      {/* Avg time */}
      <div>
        <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Avg Time (Batch)</p>
        <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#034852" }}>
          {q.avg_time_seconds != null ? formatSeconds(q.avg_time_seconds) : "—"}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(3,72,82,0.08)" }} />

      {/* Batch correct — hidden for FILL (manual grading, is_correct never set) */}
      {isManualGrading ? (
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Correct in Batch</p>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.35)", fontStyle: "italic" }}>Manual grading</p>
        </div>
      ) : (
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Correct in Batch</p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0abe62" }}>
            {q.batch_total_count > 0 ? `${q.batch_correct_count}/${q.batch_total_count}` : "—"}
          </p>
          {correctPct !== null && (
            <p style={{ margin: "2px 0 0", fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.4)" }}>{correctPct}% got it right</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionReviewCard({ q, idx }: { q: AttemptReviewQuestion; idx: number }) {
  const borderColor =
    q.is_correct === true  ? "#0abe62" :
    q.is_correct === false ? "#e53e3e" :
    "rgba(3,72,82,0.12)";

  const statusLabel =
    q.student_answer == null         ? "Skipped" :
    q.is_correct === true            ? "Correct" :
    q.is_correct === false           ? "Wrong"   :
    "Pending";

  const statusColor =
    q.is_correct === true  ? "#0abe62" :
    q.is_correct === false ? "#e53e3e" :
    "rgba(3,72,82,0.4)";

  const statusBg =
    q.is_correct === true  ? "rgba(10,190,98,0.09)" :
    q.is_correct === false ? "rgba(229,62,62,0.09)" :
    "rgba(3,72,82,0.07)";

  const embedUrl = q.explanation_video_url ? getYouTubeEmbedUrl(q.explanation_video_url) : null;

  return (
    <div style={{ ...card, border: `2px solid ${borderColor}`, marginBottom: "16px", padding: "0" }}>
      <div style={{ display: "flex", gap: "0", alignItems: "stretch" }}>
        {/* Left: question content */}
        <div style={{ flex: 1, padding: "24px 28px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "8px" }}>
            <p style={{ ...label, margin: 0 }}>Q{idx + 1}</p>
            <span style={{ fontSize: "11px", fontWeight: 700, color: statusColor, padding: "2px 8px", borderRadius: "100px", background: statusBg, flexShrink: 0 }}>
              {statusLabel}
            </span>
          </div>

          <MathContent html={q.content_html} style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.5, marginBottom: "14px" }} />

          {/* MCQ options */}
          {q.question_type === "MCQ" && q.options.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
              {q.options.map((opt) => {
                const isStudentAnswer = q.student_answer === opt.id;
                const isCorrect = opt.is_correct;
                const bg =
                  isCorrect && isStudentAnswer ? "rgba(10,190,98,0.12)" :
                  isCorrect                    ? "rgba(10,190,98,0.07)" :
                  isStudentAnswer              ? "rgba(229,62,62,0.08)" :
                  "rgba(3,72,82,0.03)";
                const border =
                  isCorrect && isStudentAnswer ? "#0abe62" :
                  isCorrect                    ? "#0abe62" :
                  isStudentAnswer              ? "#e53e3e" :
                  "rgba(3,72,82,0.08)";

                return (
                  <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 14px", borderRadius: "8px", background: bg, border: `1.5px solid ${border}` }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0, background: isCorrect ? "#0abe62" : isStudentAnswer ? "#e53e3e" : "rgba(3,72,82,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isCorrect && <span style={{ color: "#fff", fontSize: "10px", fontWeight: 900 }}>✓</span>}
                      {!isCorrect && isStudentAnswer && <span style={{ color: "#fff", fontSize: "10px", fontWeight: 900 }}>✕</span>}
                    </span>
                    <span style={{ fontSize: "14px", color: "#034852" }}>{opt.option_text}</span>
                    {isStudentAnswer && !isCorrect && (
                      <span style={{ fontSize: "11px", color: "#e53e3e", marginLeft: "auto" }}>Your answer</span>
                    )}
                    {isCorrect && (
                      <span style={{ fontSize: "11px", color: "#0abe62", marginLeft: "auto" }}>Correct</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* FILL / NUMERICAL */}
          {(q.question_type === "FILL" || q.question_type === "NUMERICAL") && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(3,72,82,0.04)", border: "1px solid rgba(3,72,82,0.1)" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "rgba(3,72,82,0.5)", fontWeight: 600 }}>Your answer</p>
                <p style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 700, color: q.is_correct === false ? "#e53e3e" : "#034852" }}>
                  {q.student_answer ?? "—"}
                </p>
              </div>
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(10,190,98,0.07)", border: "1px solid rgba(10,190,98,0.2)" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "#0abe62", fontWeight: 600 }}>Correct answer</p>
                <p style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 700, color: "#034852" }}>{q.correct_answer ?? "—"}</p>
              </div>
            </div>
          )}

          {/* Explanation video */}
          {embedUrl && (
            <div style={{ marginTop: "16px" }}>
              <p style={{ ...label, color: "#034852", marginBottom: "8px" }}>Explanation</p>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "10px", overflow: "hidden" }}>
                <iframe
                  src={embedUrl}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: analytics panel */}
        <div style={{ borderLeft: `1.5px solid ${borderColor}30`, padding: "24px 20px", display: "flex", alignItems: "flex-start" }}>
          <QuestionAnalyticsPanel q={q} />
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ section }: { section: AttemptReviewSection }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      background: "rgba(3,72,82,0.04)",
      borderRadius: "8px",
      marginBottom: "12px",
    }}>
      <h3 style={{ margin: 0, fontSize: "16px", color: "#034852", fontWeight: 700 }}>
        {section.title}
      </h3>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {section.score != null && section.max_score != null && (
          <span style={{ fontWeight: 700, color: "#034852" }}>
            {section.score}/{section.max_score}
            {section.max_score > 0 && (
              <span style={{ fontWeight: 500, color: "rgba(3,72,82,0.6)", marginLeft: "4px" }}>
                ({Math.round((section.score / section.max_score) * 100)}%)
              </span>
            )}
          </span>
        )}
        {section.passed != null && (
          <span style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: "100px",
            background: section.passed ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.1)",
            color: section.passed ? "#0abe62" : "#e53e3e",
          }}>
            {section.passed ? "Passed" : "Failed"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttemptReviewPage() {
  const { id: quizId, attemptId } = useParams<{ id: string; attemptId: string }>();
  const router = useRouter();

  const { data: userData } = useCurrentUser();
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAttemptReview(attemptId)
      .then(setReview)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load review."))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading review…</p>
    </div>
  );

  if (error) return (
    <div style={page}>
      <div style={card}>
        <p style={{ color: "#e53e3e", fontSize: "15px", fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.back()} style={{ marginTop: "16px", padding: "10px 20px", borderRadius: "10px", border: "none", background: "rgba(3,72,82,0.08)", color: "#034852", fontWeight: 700, cursor: "pointer" }}>Go back</button>
      </div>
    </div>
  );

  if (!review) return null;

  const pct = review.max_score > 0 ? Math.round((review.score / review.max_score) * 100) : null;
  const correct  = review.questions.filter((q) => q.is_correct === true).length;
  const wrong    = review.questions.filter((q) => q.is_correct === false).length;
  const skipped  = review.questions.filter((q) => q.student_answer == null).length;
  const totalTime = review.questions.reduce((s, q) => s + (q.time_taken_seconds ?? 0), 0);

  const groupedBySection = review.sections.length > 0
    ? review.sections.map((s) => ({
        section: s,
        questions: review.questions.filter((q) => q.section_id === s.section_id),
      }))
    : null;

  const renderQuestionCard = (q: AttemptReviewQuestion, idx: number) => (
    <QuestionReviewCard key={q.snapshot_id} q={q} idx={idx} />
  );

  return (
    <div style={page}>
      <button
        onClick={() => router.push(`/dashboard/quiz/${quizId}`)}
        style={{ fontSize: "13px", color: "#209379", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "20px", display: "block" }}
      >
        ← Back to Quiz
      </button>

      {/* Summary card */}
      <div style={card}>
        <p style={label}>Post-Test Review</p>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "40px", fontWeight: 900, color: "#034852", margin: 0 }}>
              {review.score}/{review.max_score}
            </p>
            {pct !== null && <p style={{ fontSize: "16px", color: "rgba(3,72,82,0.5)", margin: "2px 0 0" }}>{pct}%</p>}
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <Stat label="Correct"  value={correct}  color="#0abe62" />
            <Stat label="Wrong"    value={wrong}    color="#e53e3e" />
            <Stat label="Skipped"  value={skipped}  color="rgba(3,72,82,0.4)" />
            {totalTime > 0 && <Stat label="Total time" value={`${Math.round(totalTime / 60)}m ${totalTime % 60}s`} color="#209379" />}
          </div>
        </div>
      </div>

      {/* Question-by-question */}
      {groupedBySection ? (
        <>
          {groupedBySection.map(({ section, questions }) => (
            <div key={section.section_id} style={{ marginBottom: "32px" }}>
              <SectionHeader section={section} />
              {questions.map((q, i) => renderQuestionCard(q, i))}
            </div>
          ))}
        </>
      ) : (
        review.questions.map((q, i) => renderQuestionCard(q, i))
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        {userData?.user?.programme === "PG" && (
          <button
            onClick={() => router.push(`/dashboard/quiz/${quizId}/leaderboard`)}
            style={{ padding: "11px 22px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg,#0abe62,#006d6c)", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
          >
            View Leaderboard
          </button>
        )}
        <button
          onClick={() => router.push("/dashboard/assessments")}
          style={{ padding: "11px 22px", border: "none", borderRadius: "12px", background: "rgba(3,72,82,0.07)", color: "#034852", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
        >
          Back to Assessments
        </button>
      </div>
    </div>
  );
}

function Stat({ label: l, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: "10px 16px", borderRadius: "10px", background: `${color}12`, border: `1px solid ${color}30`, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</p>
    </div>
  );
}
