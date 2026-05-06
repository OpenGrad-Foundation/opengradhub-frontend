"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getAvailableQuizzes, getQuizAttempts, type Quiz } from "@/lib/api";

const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "STUDENT",
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const router = useRouter();

  const roleCode       = data?.role?.code ?? "";
  const programmeType  = data?.user?.programme ?? null;
  const studentId      = data?.user?.id ?? "";

  const isStudent = roleCode === "STUDENT";

  const [quizzes, setQuizzes]   = useState<Omit<Quiz, "questions">[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Attempt counts keyed by quiz_id
  const [attemptCounts, setAttemptCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (userLoading || !isStudent || !studentId) return;
    setLoading(true);
    getAvailableQuizzes(studentId)
      .then(async (qs) => {
        setQuizzes(qs);
        // Fetch attempt counts for each quiz in parallel
        const counts: Record<string, number> = {};
        await Promise.all(
          qs.map(async (q) => {
            try {
              const attempts = await getQuizAttempts(q.id, studentId);
              counts[q.id] = attempts.filter((a) => a.is_complete).length;
            } catch {
              counts[q.id] = 0;
            }
          }),
        );
        setAttemptCounts(counts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assessments."))
      .finally(() => setLoading(false));
  }, [userLoading, isStudent, studentId]);

  if (userLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  // Access guard
  if (!ALLOWED_ROLES.includes(roleCode)) {
    return <AccessDenied reason="Your role does not have permission to view this module." />;
  }

  // ── Admin/Manager view ───────────────────────────────────────────────────
  if (!isStudent) {
    return (
      <div>
        <PageHeader />
        <div style={glassCard}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
            Admin View
          </p>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#034852" }}>
            Global tests are managed in Course Bundles.
          </p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
            Attach published Global Tests to bundles from the Bundle detail page. Enrolled students will see them here.
          </p>
          <button
            onClick={() => router.push("/dashboard/bundles")}
            style={{ ...primaryBtn, marginTop: "20px" }}
          >
            Go to Course Bundles →
          </button>
        </div>
      </div>
    );
  }

  // ── Student view ─────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader />

      {error && (
        <div style={{ ...glassCard, marginBottom: "20px", background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)" }}>
          <p style={{ color: "#c53030", fontSize: "14px" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading your tests…</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
            No Tests Yet
          </p>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#034852" }}>
            No assessments assigned to you yet
          </p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)", maxWidth: "380px", margin: "8px auto 0" }}>
            Global tests will appear here once your program manager assigns them to your bundle.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {quizzes.map((q) => (
            <QuizCard
              key={q.id}
              quiz={q}
              attemptsUsed={attemptCounts[q.id] ?? 0}
              onStart={() => router.push(`/dashboard/quiz/${q.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Quiz card ─────────────────────────────────────────────────────────────────

function QuizCard({
  quiz, attemptsUsed, onStart,
}: {
  quiz: Omit<Quiz, "questions">;
  attemptsUsed: number;
  onStart: () => void;
}) {
  const maxAttempts = quiz.max_attempts;
  const exhausted   = maxAttempts != null && attemptsUsed >= maxAttempts;

  return (
    <div style={{
      background: "rgba(255,255,255,0.75)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "20px",
      padding: "24px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div>
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "#209379" }}>
          Global Test
        </p>
        <h3 style={{ margin: "6px 0 0", fontFamily: "var(--font-heading)", fontSize: "17px", fontWeight: 700, color: "#034852" }}>
          {quiz.title}
        </h3>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {quiz.duration_minutes != null && (
          <Pill>⏱ {quiz.duration_minutes} min</Pill>
        )}
        {maxAttempts != null ? (
          <Pill style={{ background: exhausted ? "rgba(229,62,62,0.08)" : undefined, color: exhausted ? "#c53030" : undefined }}>
            {attemptsUsed}/{maxAttempts} attempt{maxAttempts !== 1 ? "s" : ""}
          </Pill>
        ) : (
          <Pill>{attemptsUsed} attempt{attemptsUsed !== 1 ? "s" : ""} taken</Pill>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={exhausted}
        style={{
          marginTop: "auto",
          padding: "10px 18px", border: "none", borderRadius: "10px",
          background: exhausted
            ? "rgba(3,72,82,0.08)"
            : "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
          color: exhausted ? "rgba(3,72,82,0.35)" : "#fff",
          fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
          cursor: exhausted ? "default" : "pointer",
          boxShadow: exhausted ? "none" : "0 4px 12px rgba(10,190,98,0.2)",
        }}
      >
        {exhausted ? "No attempts remaining" : attemptsUsed > 0 ? "Retake Test" : "Start Test"}
      </button>
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ ...glassCard, marginBottom: "28px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", marginBottom: "8px" }}>
        Assessments
      </p>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, color: "#034852", margin: 0 }}>
        Mock Tests &amp; Global Assessments
      </h1>
      <p style={{ marginTop: "6px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
        Tests assigned to your programme bundle.
      </p>
    </div>
  );
}

function AccessDenied({ reason }: { reason: string }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center", maxWidth: "440px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62" }}>
          Access Denied
        </p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
          No access to Assessments
        </p>
        <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>{reason}</p>
      </div>
    </div>
  );
}

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
      background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.7)",
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "28px 32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 20px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "13px", cursor: "pointer",
  boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
};
