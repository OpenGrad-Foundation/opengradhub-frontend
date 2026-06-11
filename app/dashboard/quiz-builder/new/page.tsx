"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { createQuiz } from "@/lib/api";

export default function NewQuizPage() {
  const router = useRouter();
  const params = useSearchParams();
  const moduleId  = params.get("module_id")  ?? "";
  const courseId  = params.get("course_id")  ?? "";

  const { data, isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const invalidate = useInvalidate();
  const userId   = data?.user?.id ?? "";

  const [title, setTitle]                   = useState("");
  const [duration, setDuration]             = useState("");
  const [maxAttempts, setMaxAttempts]       = useState("");
  const [passThreshold, setPassThreshold]   = useState("");
  const [shuffle, setShuffle]               = useState(false);
  const [showAnswers, setShowAnswers]       = useState(true);
  const [isSectioned, setIsSectioned]       = useState(false);
  const [sequentialSections, setSequentialSections] = useState(false);
  const [firstAttemptCounts, setFirstAttemptCounts] = useState(false);
  const [requireFullscreen, setRequireFullscreen]   = useState(false);
  const [negativeMarking, setNegativeMarking]       = useState(false);
  const [correctMarks, setCorrectMarks]             = useState("1");
  const [wrongMarks, setWrongMarks]                 = useState("0");
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  const quizType = moduleId ? "MODULE_TEST" : "GLOBAL_TEST";
  const backHref = courseId ? `/dashboard/courses/${courseId}/builder` : "/dashboard/test-bank";

  if (userLoading || permLoading) return null;

  if (!has(PERM.test_bank.create)) {
    return (
      <div style={glassCard}>
        <p style={label}>Access Denied</p>
        <p style={{ ...heading, marginTop: "12px" }}>You don&apos;t have permission to create quizzes.</p>
      </div>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const quiz = await createQuiz({
        title:                  title.trim(),
        quiz_type:              quizType as "MODULE_TEST" | "GLOBAL_TEST",
        module_id:              moduleId || undefined,
        duration_minutes:       duration      ? Number(duration)      : undefined,
        max_attempts:           maxAttempts   ? Number(maxAttempts)   : undefined,
        pass_threshold_percent: passThreshold ? Number(passThreshold) : undefined,
        shuffle_questions:      shuffle,
        show_answers_after:     showAnswers,
        created_by:             userId || undefined,
        is_sectioned:           isSectioned,
        sequential_sections:    isSectioned ? sequentialSections : false,
        first_attempt_counts:   firstAttemptCounts,
        require_fullscreen:     requireFullscreen,
        negative_marking:       negativeMarking,
        correct_marks:          correctMarks ? Number(correctMarks) : 1,
        wrong_marks:            negativeMarking ? (wrongMarks ? Number(wrongMarks) : 0) : 0,
      });
      invalidate('quizzes');
      // Redirect to the full builder with course context preserved
      const target = `/dashboard/quiz-builder/${quiz.id}${courseId ? `?course_id=${courseId}` : ""}`;
      router.replace(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quiz.");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <a href={backHref} style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
          ← Back
        </a>
        <p style={{ ...label, marginTop: "12px" }}>{quizType === "MODULE_TEST" ? "Module Quiz" : "Global Quiz"}</p>
        <h1 style={{ ...heading, fontSize: "28px", margin: "4px 0 0" }}>New Quiz</h1>
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
          Set up the quiz — you can add questions after saving.
        </p>
      </div>

      <form onSubmit={(e) => void handleCreate(e)}>
        <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: "18px" }}>
          <Field label="Quiz Title *">
            <input value={title} onChange={e => setTitle(e.target.value)} style={input} placeholder="e.g. Chapter 3 Revision Quiz" required />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Duration (minutes, 0 = untimed)">
              <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} style={input} placeholder="0" />
            </Field>
            <Field label="Max Attempts (0 = unlimited)">
              <input type="number" min="0" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} style={input} placeholder="0" />
            </Field>
          </div>

          <Field label="Pass Threshold (%)">
            <input type="number" min="0" max="100" value={passThreshold} onChange={e => setPassThreshold(e.target.value)} style={input} placeholder="e.g. 60" />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Toggle value={shuffle} onChange={setShuffle} label="Shuffle Questions" description="Randomise question order for each attempt" />
            <Toggle value={showAnswers} onChange={setShowAnswers} label="Show Answers After Submission" description="Students can review correct answers after submitting" />
            <Toggle value={isSectioned} onChange={setIsSectioned} label="Section-wise quiz" description="Group questions into named sections (Aptitude, Logical, Math, etc.)" />
            {isSectioned && (
              <Toggle value={sequentialSections} onChange={setSequentialSections} label="Sequential sections" description="Students complete sections in order with their own timers; no going back." />
            )}
            <Toggle value={firstAttemptCounts} onChange={setFirstAttemptCounts} label="First attempt counts" description="Subsequent retakes allowed but don't change the grade." />
            <Toggle value={requireFullscreen} onChange={setRequireFullscreen} label="Require fullscreen during attempt" description="Desktop only — students on mobile blocked from starting." />
            <Toggle value={negativeMarking} onChange={setNegativeMarking} label="Negative marking" description="Deduct marks for wrong answers; blanks are never penalized." />
            {negativeMarking && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <Field label="Marks per correct answer">
                  <input type="text" inputMode="decimal" value={correctMarks} onChange={e => setCorrectMarks(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} style={input} placeholder="4" />
                </Field>
                <Field label="Penalty per wrong answer">
                  <input type="text" inputMode="decimal" value={wrongMarks} onChange={e => setWrongMarks(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} style={input} placeholder="1" />
                </Field>
              </div>
            )}
          </div>

          {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Creating…" : "Create Quiz & Add Questions →"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)" }}>{lbl}</p>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label: lbl, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(3,72,82,0.03)", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.07)" }}>
      <div>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852" }}>{lbl}</p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
          background: value ? "#0abe62" : "rgba(3,72,82,0.15)",
          position: "relative", transition: "background 200ms ease", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: "2px",
          left: value ? "22px" : "2px",
          width: "20px", height: "20px", borderRadius: "50%",
          background: "#fff", transition: "left 200ms ease",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};
const label: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0,
};
const heading: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852",
};
const primaryBtn: React.CSSProperties = {
  padding: "12px 24px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px",
  cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", transition: "all 240ms ease",
};
const input: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box",
};
