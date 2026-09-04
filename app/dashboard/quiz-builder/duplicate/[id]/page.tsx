"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { getQuizById, duplicateQuiz, type Quiz, type Question } from "@/lib/api";
import { QuizStudentPreview } from "@/components/quiz-student-preview";
import { useDuplicateDestination, DestinationPicker } from "@/components/duplicate-destination";

/**
 * Read-only look at another programme's quiz, with the one action the browse
 * flow exists for. No editing controls: the server would refuse them anyway
 * (browse is sight, not authority), and offering them would be a lie.
 */
export default function DuplicateQuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { has, isLoading: permLoading } = usePermissions();
  const invalidate = useInvalidate();
  const destination = useDuplicateDestination();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const canCreate = has(PERM.test_bank.create);

  useEffect(() => {
    if (permLoading || !canCreate) return;
    let cancelled = false;
    void getQuizById(id)
      .then((q) => { if (!cancelled) setQuiz(q); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load quiz."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, permLoading, canCreate]);

  async function handleDuplicate() {
    if (!quiz) return;
    if (destination.needsChoice && !destination.isSuperAdmin && !destination.selected) {
      setError("Choose which programme this copy belongs to.");
      return;
    }
    setDuplicating(true);
    setError(null);
    try {
      const copy = await duplicateQuiz(quiz.id, destination.bodyValue);
      invalidate("quizzes");
      router.push(`/dashboard/quiz-builder/${copy.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to duplicate quiz.");
      setDuplicating(false);
    }
  }

  if (permLoading) return null;
  if (!canCreate) {
    return (
      <div style={glassCard}>
        <p style={label}>Access Denied</p>
        <p style={{ ...heading, fontSize: "22px", marginTop: "12px" }}>You don&apos;t have permission to duplicate quizzes.</p>
      </div>
    );
  }
  if (loading) return <div style={glassCard}><p style={muted}>Loading quiz…</p></div>;
  if (!quiz) {
    return (
      <div style={glassCard}>
        <p style={label}>Error</p>
        <p style={{ ...heading, fontSize: "22px", marginTop: "12px" }}>{error ?? "Quiz not found."}</p>
      </div>
    );
  }

  const questions: Question[] = quiz.is_sectioned ? quiz.sections.flatMap((s) => s.questions) : quiz.questions;

  return (
    <div style={{ maxWidth: "960px" }}>
      <BackLink fallback="/dashboard/quiz-builder/duplicate" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Duplicate a quiz
      </BackLink>

      <div style={{ ...glassCard, marginTop: "16px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: "260px" }}>
          <p style={label}>Read only</p>
          <h1 style={{ ...heading, fontSize: "26px", margin: "6px 0 8px" }}>{quiz.title}</h1>
          {quiz.description && <p style={{ ...muted, fontSize: "14px", lineHeight: 1.6 }}>{quiz.description}</p>}
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px", marginTop: "16px" }}>
            <Stat k="Programme" v={quiz.effective_scope_mode === "GLOBAL" ? "Shared with all" : quiz.owner_programme_name ?? "Unassigned"} />
            <Stat k="Questions" v={String(questions.length)} />
            <Stat k="Duration" v={quiz.duration_minutes ? `${quiz.duration_minutes} min` : "Untimed"} />
            <Stat k="Attempts" v={quiz.max_attempts ? String(quiz.max_attempts) : "Unlimited"} />
            <Stat k="Pass mark" v={quiz.pass_threshold_percent != null ? `${quiz.pass_threshold_percent}%` : "—"} />
            <Stat k="Sections" v={quiz.is_sectioned ? `${quiz.sections.length}${quiz.sequential_sections ? " (sequential)" : ""}` : "No"} />
            <Stat k="Negative marking" v={quiz.negative_marking ? `−${quiz.wrong_marks} / +${quiz.correct_marks}` : "No"} />
          </dl>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "stretch", minWidth: "220px" }}>
          <DestinationPicker state={destination} />
          <button
            type="button"
            onClick={() => void handleDuplicate()}
            disabled={duplicating || destination.loading}
            style={{ ...primaryBtn, opacity: duplicating ? 0.7 : 1 }}
          >
            {duplicating ? "Duplicating…" : "Duplicate this quiz"}
          </button>
          <button type="button" onClick={() => setPreviewOpen(true)} style={outlineBtn}>
            Preview as student
          </button>
          {error && <p style={{ margin: 0, fontSize: "12px", color: "#e53e3e" }}>{error}</p>}
        </div>
      </div>

      <div style={{ ...glassCard, marginTop: "16px", padding: 0, overflow: "hidden" }}>
        {questions.length === 0 && <p style={{ ...muted, padding: "18px 24px" }}>This quiz has no questions yet.</p>}
        {questions.map((q, i) => (
          <div key={q.id} style={{ padding: "16px 24px", borderBottom: i === questions.length - 1 ? "none" : "1px solid rgba(3,72,82,0.06)" }}>
            <QuestionBody question={q} index={i} />
            {/* GROUP questions carry their parts as children; they are the
                quiz's real content, so a flat list under the stem is enough
                for a review-before-copy read. */}
            {q.children.length > 0 && (
              <div style={{ marginTop: "12px", paddingLeft: "16px", borderLeft: "2px solid rgba(3,72,82,0.08)", display: "flex", flexDirection: "column", gap: "12px" }}>
                {q.children.map((child) => <QuestionBody key={child.id} question={child} />)}
              </div>
            )}
          </div>
        ))}
      </div>

      {previewOpen && <QuizStudentPreview quiz={quiz} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function QuestionBody({ question, index }: { question: Question; index?: number }) {
  return (
    <div>
      <p style={{ ...muted, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {index != null ? `Q${index + 1} · ` : ""}{question.question_type}{question.marks != null ? ` · ${question.marks} marks` : ""}
      </p>
      <div style={{ fontSize: "14px", color: "#034852", marginTop: "6px" }} dangerouslySetInnerHTML={{ __html: question.content_html }} />
      {question.options.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: "6px" }}>
          {question.options.map((o) => (
            <li key={o.id} style={{ fontSize: "13px", color: o.is_correct ? "#0abe62" : "rgba(3,72,82,0.75)", fontWeight: o.is_correct ? 700 : 400 }}>
              {o.is_correct ? "✓ " : "○ "}{o.option_text}
            </li>
          ))}
        </ul>
      )}
      {question.options.length === 0 && question.correct_answer && (
        <p style={{ ...muted, marginTop: "8px" }}>Answer: <strong style={{ color: "#0abe62" }}>{question.correct_answer}</strong></p>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ background: "rgba(248,250,251,0.95)", borderRadius: "12px", padding: "10px 12px" }}>
      <dt style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(3,72,82,0.5)" }}>{k}</dt>
      <dd style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 600, color: "#034852" }}>{v}</dd>
    </div>
  );
}

const glassCard: React.CSSProperties = { background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px", padding: "28px 32px", boxShadow: "0 4px 16px rgba(0,0,0,0.05)" };
const label: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 };
const heading: React.CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0 };
const muted: React.CSSProperties = { margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.55)" };
const primaryBtn: React.CSSProperties = { padding: "12px 20px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)" };
const outlineBtn: React.CSSProperties = { padding: "10px 16px", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.18)", background: "#fff", color: "#034852", fontSize: "13px", fontWeight: 700, cursor: "pointer" };
