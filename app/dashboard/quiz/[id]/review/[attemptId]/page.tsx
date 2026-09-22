"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getBackHref, withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { getAttemptReview, getMyQuestionReports, type AttemptReview, type AttemptReviewQuestion, type AttemptReviewSection } from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PassageCard, QuestionReviewCard } from "@/components/question-review-card";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { ReportQuestionButton } from "@/components/report-question-modal";

// ── Styles ────────────────────────────────────────────────────────────────────

const page: React.CSSProperties = { maxWidth: "960px", margin: "0 auto", padding: "32px 16px", color: "var(--color-text)" };
const card: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)", marginBottom: "20px" };
const label: React.CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 };
const secondaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", color: "var(--color-text)", fontWeight: 600, fontSize: "14px", cursor: "pointer" };
const primaryBtn: React.CSSProperties = { ...secondaryBtn, border: "1px solid var(--green)", background: "var(--green)", color: "var(--dark-teal)" };



// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ section }: { section: AttemptReviewSection }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 16px",
      background: "var(--color-surface-sunken)",
      borderRadius: "8px",
      marginBottom: "12px",
    }}>
      <h3 style={{ margin: 0, fontSize: "16px", color: "var(--color-text)", fontWeight: 700 }}>
        {section.title}
      </h3>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {section.score != null && section.max_score != null && (
          <span style={{ fontWeight: 700, color: "var(--color-text)" }}>
            {section.score}/{section.max_score}
            {section.max_score > 0 && (
              <span style={{ fontWeight: 500, color: "var(--color-text-muted)", marginLeft: "4px" }}>
                ({Math.round((section.score / section.max_score) * 100)}%)
              </span>
            )}
          </span>
        )}
        {section.passed != null && (
          <span style={{
            fontSize: "12px",
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: "6px",
            background: section.passed ? "rgba(10,190,98,0.1)" : "rgba(184,50,50,0.1)",
            color: section.passed ? "#08784a" : "#b83232",
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
  const [reportedSnapshots, setReportedSnapshots] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAttemptReview(attemptId)
      .then(setReview)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load review."))
      .finally(() => setLoading(false));
  }, [attemptId]);

  // Which questions this student already reported — so the button shows "Reported" after a reload.
  useEffect(() => {
    let cancelled = false;
    getMyQuestionReports(attemptId)
      .then((rows) => {
        if (cancelled) return;
        setReportedSnapshots(
          new Set(rows.map((r) => r.question_snapshot_id).filter((s): s is string => !!s)),
        );
      })
      .catch(() => undefined); // non-blocking: never break the review screen over this
    return () => { cancelled = true; };
  }, [attemptId]);

  if (loading) return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Loading review…</p>
    </div>
  );

  if (error) return (
    <div style={page}>
      <div style={card}>
        <p style={{ color: "#b83232", fontSize: "15px", fontWeight: 600 }}>{error}</p>
        <button onClick={() => router.push(getBackHref(from, `/dashboard/quiz/${quizId}`))} style={{ ...secondaryBtn, marginTop: "16px" }}>Go back</button>
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

  // Every card in the review list is an answerable leaf (GROUP children get their own card,
  // with the passage rendered separately), so each one gets its own report control.
  const reportButtonFor = (snapshotId: string) => (
    <ReportQuestionButton
      snapshotId={snapshotId}
      alreadyReported={reportedSnapshots.has(snapshotId)}
      onReported={() => setReportedSnapshots((prev) => new Set(prev).add(snapshotId))}
    />
  );

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
              instructionHtml={q.parent_instruction_html ?? null}
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
            reportButton={reportButtonFor(q.snapshot_id)}
          />
        );
      } else {
        questionNumber++;
        items.push(
          <QuestionReviewCard
            key={q.snapshot_id}
            q={q}
            idx={questionNumber - 1}
            revealed={revealed}
            reportButton={reportButtonFor(q.snapshot_id)}
          />
        );
      }
    }
    return items;
  }

  return (
    <div style={page}>
      <button
        onClick={() => router.push(getBackHref(from, `/dashboard/quiz/${quizId}`))}
        style={{ ...secondaryBtn, marginBottom: "20px" }}
      >
        <ArrowLeft size={16} aria-hidden="true" />Back to Quiz
      </button>

      {/* Summary card */}
      <div style={card}>
        <p style={label}>Post-quiz review</p>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginTop: "16px" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "40px", fontWeight: 900, color: "var(--color-text)", margin: 0 }}>
              {review.score}/{review.max_score}
            </p>
            {pct !== null && <p style={{ fontSize: "16px", color: "var(--color-text-muted)", margin: "2px 0 0" }}>{pct}%</p>}
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <Stat label="Correct"  value={correct}  color="#08784a" />
            <Stat label="Wrong"    value={wrong}    color="#b83232" />
            <Stat label="Skipped"  value={skipped}  color="var(--color-text-muted)" />
            {totalTime > 0 && <Stat label="Total time" value={`${Math.round(totalTime / 60)}m ${totalTime % 60}s`} color="var(--color-text)" />}
          </div>
        </div>
      </div>

      {/* Quiz-level instructions — same box the intro card shows before the attempt */}
      {review.description != null && review.description.trim() !== "" && (
        <div style={{ ...card, background: "var(--color-surface-sunken)", borderLeft: "3px solid var(--green)" }}>
          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
            Test instructions
          </p>
          <MathContent html={review.description} style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-text)" }} />
        </div>
      )}

      {/* Reveal-all toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          style={revealed ? secondaryBtn : primaryBtn}
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
            style={primaryBtn}
          >
            View Leaderboard
          </button>
        )}
        <button
          onClick={() => router.push("/dashboard/assessments")}
          style={secondaryBtn}
        >
          Back to Quizzes
        </button>
      </div>
    </div>
  );
}

function Stat({ label: l, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: "10px 16px", borderRadius: "8px", background: "var(--color-surface)", border: "1px solid var(--color-border)", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--color-text-muted)", fontWeight: 500 }}>{l}</p>
    </div>
  );
}
