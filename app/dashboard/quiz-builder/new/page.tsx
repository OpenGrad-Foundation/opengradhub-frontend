"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createQuiz } from "@/lib/api";

export default function NewQuizPage() {
  const router = useRouter();
  const params = useSearchParams();
  const moduleId  = params.get("module_id")  ?? "";
  const courseId  = params.get("course_id")  ?? "";

  const { data, isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const userId   = data?.user?.id ?? "";

  const [title, setTitle]                   = useState("");
  const [duration, setDuration]             = useState("");
  const [maxAttempts, setMaxAttempts]       = useState("");
  const [passThreshold, setPassThreshold]   = useState("");
  const [shuffle, setShuffle]               = useState(false);
  const [showAnswers, setShowAnswers]       = useState(true);
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
      });
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
        <p style={{ ...label, marginTop: "12px" }}>{quizType === "MODULE_TEST" ? "Module Test" : "Global Test"}</p>
        <h1 style={{ ...heading, fontSize: "28px", margin: "4px 0 0" }}>New Quiz</h1>
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
          Set up the quiz — you can add questions after saving.
        </p>
      </div>

      <form onSubmit={(e) => void handleCreate(e)}>
        <div style={{ ...glassCard, display: "flex", flexDirection: "column", gap: "18px" }}>
          <Field label="Quiz Title *">
            <input value={title} onChange={e => setTitle(e.target.value)} style={input} placeholder="e.g. Chapter 3 Revision Test" required />
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
