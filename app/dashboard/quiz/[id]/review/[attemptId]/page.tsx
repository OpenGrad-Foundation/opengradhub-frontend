"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getBackHref, withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { getAttemptReview, type AttemptReview, type AttemptReviewQuestion, type AttemptReviewSection } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PassageCard, QuestionReviewCard, label } from "@/components/question-review-card";

// ── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { maxWidth: "960px", margin: "0 auto", padding: "32px 16px", color: "#034852" };
const card: React.CSSProperties = { background: "rgba(255,255,255,0.85)", borderRadius: "16px", padding: "28px 32px", boxShadow: "0 2px 24px rgba(3,72,82,0.08)", marginBottom: "20px" };



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
  const from = useSearchParams().get("from");
  const currentUrl = useCurrentUrl();

  const { data: userData } = useCurrentUser();
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Correct answers hidden until the student reveals them — lets them re-think
  // each question (no time limit) before checking.
  const [revealed, setRevealed] = useState(false);

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
        <button onClick={() => router.push(getBackHref(from, `/dashboard/quiz/${quizId}`))} style={{ marginTop: "16px", padding: "10px 20px", borderRadius: "10px", border: "none", background: "rgba(3,72,82,0.08)", color: "#034852", fontWeight: 700, cursor: "pointer" }}>Go back</button>
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

  // Build a flat render list that inserts a PassageCard before the first child of each GROUP.
  function buildRenderItems(questions: AttemptReviewQuestion[]) {
    const items: React.ReactNode[] = [];
    const seenParents = new Set<string>();
    const partCounters = new Map<string, number>();
    let questionNumber = 0;
    for (const q of questions) {
      if (q.parent_snapshot_id) {
        if (!seenParents.has(q.parent_snapshot_id)) {
          seenParents.add(q.parent_snapshot_id);
          partCounters.set(q.parent_snapshot_id, 0);
          questionNumber++;
          items.push(
            <PassageCard
              key={`passage-${q.parent_snapshot_id}`}
              html={q.parent_content_html ?? ""}
              imageUrl={q.parent_image_url ?? null}
            />
          );
        }
        const partNum = (partCounters.get(q.parent_snapshot_id) ?? 0) + 1;
        partCounters.set(q.parent_snapshot_id, partNum);
        items.push(
          <QuestionReviewCard
            key={q.snapshot_id}
            q={q}
            idx={questionNumber - 1}
            revealed={revealed}
            questionLabel={`Part ${partNum}`}
          />
        );
      } else {
        questionNumber++;
        items.push(
          <QuestionReviewCard key={q.snapshot_id} q={q} idx={questionNumber - 1} revealed={revealed} />
        );
      }
    }
    return items;
  }

  return (
    <div style={page}>
      <button
        onClick={() => router.push(getBackHref(from, `/dashboard/quiz/${quizId}`))}
        style={{ fontSize: "13px", color: "#209379", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: "20px", display: "block" }}
      >
        ← Back to Quiz
      </button>

      {/* Summary card */}
      <div style={card}>
        <p style={label}>Post-Quiz Review</p>
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

      {/* Reveal-all toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 18px", borderRadius: "10px", border: `1.5px solid ${revealed ? "rgba(3,72,82,0.15)" : "#0abe62"}`, background: revealed ? "rgba(3,72,82,0.04)" : "rgba(10,190,98,0.08)", color: revealed ? "#034852" : "#0abe62", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}
        >
          {revealed ? "Hide Answers" : "Reveal Answers"}
        </button>
      </div>

      {/* Question-by-question */}
      {groupedBySection ? (
        <>
          {groupedBySection.map(({ section, questions }) => (
            <div key={section.section_id} style={{ marginBottom: "32px" }}>
              <SectionHeader section={section} />
              {buildRenderItems(questions)}
            </div>
          ))}
        </>
      ) : (
        buildRenderItems(review.questions)
      )}

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        {userData?.user?.programme === "PG" && (
          <button
            onClick={() => router.push(withFrom(`/dashboard/quiz/${quizId}/leaderboard`, currentUrl))}
            style={{ padding: "11px 22px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg,#0abe62,#006d6c)", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
          >
            View Leaderboard
          </button>
        )}
        <button
          onClick={() => router.push("/dashboard/assessments")}
          style={{ padding: "11px 22px", border: "none", borderRadius: "12px", background: "rgba(3,72,82,0.07)", color: "#034852", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
        >
          Back to Quizzes
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
