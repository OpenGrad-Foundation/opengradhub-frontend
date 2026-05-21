"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getAvailableQuizzes, getModuleQuizzes, getQuizAttempts, getTopicStrength, getBatchComparison, getStudentEnrolments, downloadStudentMonthlyReportPdf, downloadStudentCourseReportPdf, type Quiz, type ModuleQuiz, type QuizAttempt, type TopicStrengthRow, type BatchComparison, type Course, type StudentReportPdf } from "@/lib/api";

// ── PDF helper ────────────────────────────────────────────────────────────────
// The report endpoints are bearer-token protected, so `window.open` cannot fetch
// them directly. Each PDF is fetched as a blob via the api helpers and the
// resulting object URL is opened in a new tab (with a download fallback if the
// popup is blocked).
function openPdf({ blob, filename }: StudentReportPdf) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const router = useRouter();

  const studentId      = data?.user?.id ?? "";

  // Attempters get the quiz list; others with `assessments.view` get the admin view.
  const canAttempt = has(PERM.assessments.attempt);

  const [quizzes, setQuizzes]           = useState<Omit<Quiz, "questions">[]>([]);
  const [moduleQuizzes, setModuleQuizzes] = useState<ModuleQuiz[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Completed attempts keyed by quiz_id
  const [attemptsByQuiz, setAttemptsByQuiz] = useState<Record<string, QuizAttempt[]>>({});
  const [topicStrength, setTopicStrength] = useState<TopicStrengthRow[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [batchComparison, setBatchComparison] = useState<BatchComparison | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  useEffect(() => {
    if (userLoading || !canAttempt || !studentId) return;
    setLoading(true);
    Promise.all([getAvailableQuizzes(), getModuleQuizzes()])
      .then(async ([globalQs, moduleQs]) => {
        setQuizzes(globalQs);
        setModuleQuizzes(moduleQs);
        // Fetch completed attempts for all quizzes in parallel
        const allQs = [...globalQs, ...moduleQs];
        const byQuiz: Record<string, QuizAttempt[]> = {};
        await Promise.all(
          allQs.map(async (q) => {
            try {
              const attempts = await getQuizAttempts(q.id);
              byQuiz[q.id] = attempts.filter((a) => a.is_complete);
            } catch {
              byQuiz[q.id] = [];
            }
          }),
        );
        setAttemptsByQuiz(byQuiz);
        getTopicStrength(studentId).then(setTopicStrength).catch(() => {});
        getStudentEnrolments(studentId).then((courses) => {
          setEnrolledCourses(courses);
          if (courses.length > 0) setSelectedCourseId(courses[0].id);
        }).catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assessments."))
      .finally(() => setLoading(false));
  }, [userLoading, canAttempt, studentId]);

  useEffect(() => {
    if (!selectedCourseId || !studentId) return;
    setBatchLoading(true);
    setBatchComparison(null);
    getBatchComparison(studentId, selectedCourseId)
      .then(setBatchComparison)
      .catch(() => {})
      .finally(() => setBatchLoading(false));
  }, [selectedCourseId, studentId]);

  async function handleDownloadMonthly() {
    setDownloadingReport(true);
    setError(null);
    try {
      openPdf(await downloadStudentMonthlyReportPdf("me"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download monthly report.");
    } finally {
      setDownloadingReport(false);
    }
  }

  async function handleDownloadCourse() {
    if (!selectedCourseId) return;
    setDownloadingReport(true);
    setError(null);
    try {
      openPdf(await downloadStudentCourseReportPdf("me", selectedCourseId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download course report.");
    } finally {
      setDownloadingReport(false);
    }
  }

  if (userLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  // ── Admin/Manager view ───────────────────────────────────────────────────
  if (!canAttempt) {
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
  const selectedCourse = enrolledCourses.find((c) => c.id === selectedCourseId);

  return (
    <div>
      <PageHeader />

      <div style={{ ...glassCard, marginBottom: "20px", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 4px" }}>
            My Report
          </p>
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: 0 }}>
            Download your performance report as a PDF.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={handleDownloadMonthly}
            disabled={downloadingReport}
            style={{
              ...primaryBtn,
              opacity: downloadingReport ? 0.6 : 1,
              cursor: downloadingReport ? "not-allowed" : "pointer",
            }}
          >
            {downloadingReport ? "Preparing…" : "Download monthly report (PDF)"}
          </button>
          {selectedCourseId && (
            <button
              onClick={handleDownloadCourse}
              disabled={downloadingReport}
              style={{
                padding: "10px 20px",
                border: "1.5px solid rgba(3,72,82,0.15)",
                borderRadius: "10px",
                background: "#fff",
                color: "#209379",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "13px",
                opacity: downloadingReport ? 0.6 : 1,
                cursor: downloadingReport ? "not-allowed" : "pointer",
              }}
            >
              {downloadingReport
                ? "Preparing…"
                : `Download course report${selectedCourse ? ` — ${selectedCourse.title}` : ""} (PDF)`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ ...glassCard, marginBottom: "20px", background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)" }}>
          <p style={{ color: "#c53030", fontSize: "14px" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading your tests…</p>
        </div>
      ) : quizzes.length === 0 && moduleQuizzes.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
            No Tests Yet
          </p>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#034852" }}>No assessments assigned to you yet</p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)", maxWidth: "380px", margin: "8px auto 0" }}>
            Tests will appear here once you are enrolled in courses with module tests or program bundles.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Module tests */}
          {moduleQuizzes.length > 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 14px" }}>
                Module Tests
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {moduleQuizzes.map((q) => (
                  <QuizRow
                    key={q.id}
                    quiz={q}
                    label={`${q.course_title} · ${q.module_title}`}
                    attempts={attemptsByQuiz[q.id] ?? []}
                    onStart={() => router.push(`/dashboard/quiz/${q.id}`)}
                    onReview={(attemptId) => router.push(`/dashboard/quiz/${q.id}/review/${attemptId}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Global / program tests */}
          {quizzes.length > 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 14px" }}>
                Program Tests
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {quizzes.map((q) => (
                  <QuizRow
                    key={q.id}
                    quiz={q}
                    label="Global Test"
                    attempts={attemptsByQuiz[q.id] ?? []}
                    onStart={() => router.push(`/dashboard/quiz/${q.id}`)}
                    onReview={(attemptId) => router.push(`/dashboard/quiz/${q.id}/review/${attemptId}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {(topicStrength.length > 0 || enrolledCourses.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px", marginTop: "20px", alignItems: "start" }}>
          {topicStrength.length > 0 && <TopicStrengthPanel rows={topicStrength} />}

          {enrolledCourses.length > 0 && (
            <BatchComparisonPanel
              courses={enrolledCourses}
              selectedCourseId={selectedCourseId}
              onCourseChange={setSelectedCourseId}
              data={batchComparison}
              loading={batchLoading}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Quiz row ──────────────────────────────────────────────────────────────────

function QuizRow({
  quiz, label, attempts, onStart, onReview,
}: {
  quiz: Omit<Quiz, "questions">;
  label: string;
  attempts: QuizAttempt[];
  onStart: () => void;
  onReview: (attemptId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const maxAttempts  = quiz.max_attempts;
  const attemptsUsed = attempts.length;
  const exhausted    = maxAttempts != null && attemptsUsed >= maxAttempts;

  const sorted = [...attempts].sort((a, b) => {
    const ta = a.submitted_at ? Date.parse(a.submitted_at) : 0;
    const tb = b.submitted_at ? Date.parse(b.submitted_at) : 0;
    return tb - ta;
  });

  const bestPct = sorted.reduce<number | null>((best, a) => {
    if (a.score == null || !a.max_score) return best;
    const pct = Math.round((a.score / a.max_score) * 100);
    return best == null || pct > best ? pct : best;
  }, null);

  return (
    <div style={{
      background: "rgba(255,255,255,0.75)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "14px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
      overflow: "hidden",
    }}>
      {/* Row */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px" }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          disabled={attemptsUsed === 0}
          aria-label={expanded ? "Collapse attempts" : "Show attempts"}
          style={{
            width: "24px", height: "24px", flexShrink: 0,
            border: "none", borderRadius: "6px",
            background: attemptsUsed === 0 ? "transparent" : "rgba(3,72,82,0.06)",
            color: attemptsUsed === 0 ? "rgba(3,72,82,0.2)" : "#209379",
            cursor: attemptsUsed === 0 ? "default" : "pointer",
            fontSize: "12px", fontWeight: 700,
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          ▶
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "#209379" }}>
            {label}
          </p>
          <h3 style={{ margin: "3px 0 0", fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700, color: "#034852", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {quiz.title}
          </h3>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
          {quiz.duration_minutes != null && <Pill>⏱ {quiz.duration_minutes} min</Pill>}
          {maxAttempts != null ? (
            <Pill style={{ background: exhausted ? "rgba(229,62,62,0.08)" : undefined, color: exhausted ? "#c53030" : undefined }}>
              {attemptsUsed}/{maxAttempts} attempt{maxAttempts !== 1 ? "s" : ""}
            </Pill>
          ) : (
            <Pill>{attemptsUsed} attempt{attemptsUsed !== 1 ? "s" : ""}</Pill>
          )}
          {bestPct !== null && (
            <Pill style={{ background: "rgba(10,190,98,0.1)", color: "#0abe62" }}>Best {bestPct}%</Pill>
          )}
        </div>

        <button
          onClick={onStart}
          disabled={exhausted}
          style={{
            flexShrink: 0,
            padding: "9px 18px", border: "none", borderRadius: "10px",
            background: exhausted
              ? "rgba(3,72,82,0.08)"
              : "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
            color: exhausted ? "rgba(3,72,82,0.35)" : "#fff",
            fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
            cursor: exhausted ? "default" : "pointer",
            boxShadow: exhausted ? "none" : "0 4px 12px rgba(10,190,98,0.2)",
          }}
        >
          {exhausted ? "No attempts left" : attemptsUsed > 0 ? "Retake" : "Start"}
        </button>
      </div>

      {/* Expanded attempts */}
      {expanded && attemptsUsed > 0 && (
        <div style={{ borderTop: "1px solid rgba(3,72,82,0.08)", background: "rgba(3,72,82,0.02)", padding: "10px 20px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {sorted.map((a) => {
            const pct  = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null;
            const date = a.submitted_at
              ? new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : "—";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "6px 0" }}>
                <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: "13px", color: "#034852" }}>
                  <span style={{ fontWeight: 700 }}>Attempt {a.attempt_number}</span>
                  {" · "}{a.score ?? "?"}/{a.max_score ?? "?"}{pct !== null ? ` (${pct}%)` : ""}
                  {" · "}<span style={{ color: "rgba(3,72,82,0.45)" }}>{date}</span>
                </p>
                {a.passed !== null && (
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", flexShrink: 0, background: a.passed ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.1)", color: a.passed ? "#0abe62" : "#e53e3e" }}>
                    {a.passed ? "Passed" : "Failed"}
                  </span>
                )}
                {quiz.show_answers_after && (
                  <button
                    onClick={() => onReview(a.id)}
                    style={{ flexShrink: 0, padding: "5px 12px", border: "1px solid rgba(3,72,82,0.15)", borderRadius: "8px", background: "#fff", color: "#209379", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  >
                    Review →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
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
        Assessments
      </h1>
      <p style={{ marginTop: "6px", fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>
        Module tests from your courses and programme-wide mock tests.
      </p>
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

// ── Topic Strength Panel ──────────────────────────────────────────────────────

const STRONG_THRESHOLD = 70; // accuracy % at/above which a topic counts as "strong"

function TopicStrengthPanel({ rows }: { rows: TopicStrengthRow[] }) {
  // rows arrive sorted weakest → strongest. Split by threshold so a topic never
  // shows in both columns; cap each side at 5 to keep the panel compact.
  const needsWork = rows.filter((r) => r.accuracy_pct < STRONG_THRESHOLD).slice(0, 5);
  const strongest = rows.filter((r) => r.accuracy_pct >= STRONG_THRESHOLD).reverse().slice(0, 5);

  return (
    <div style={{ ...glassCard, padding: "20px 24px" }}>
      <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 16px" }}>
        Topic Strength
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Needs work */}
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#e53e3e", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
            Needs Work
          </p>
          {needsWork.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {needsWork.map((row) => (
                <TopicBar key={`${row.subject}:${row.topic}`} row={row} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.4)", margin: 0 }}>
              No weak areas — every topic is at {STRONG_THRESHOLD}% or above.
            </p>
          )}
        </div>

        {/* Strongest */}
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#0abe62", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
            Strongest Areas
          </p>
          {strongest.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {strongest.map((row) => (
                <TopicBar key={`${row.subject}:${row.topic}`} row={row} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.4)", margin: 0 }}>
              Keep practising to build strong topics.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicBar({ row }: { row: TopicStrengthRow }) {
  const pct   = row.accuracy_pct;
  const color = pct < 40 ? "#e53e3e" : pct < 70 ? "#d97706" : "#0abe62";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>
          {row.subject}{row.topic ? ` — ${row.topic}` : ""}
        </p>
        <span style={{ fontSize: "12px", fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: "6px", borderRadius: "100px", background: "rgba(3,72,82,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "100px", background: color, transition: "width 0.6s ease" }} />
      </div>
      <p style={{ margin: "2px 0 0", fontSize: "10px", color: "rgba(3,72,82,0.4)" }}>
        {row.correct}/{row.total} correct
      </p>
    </div>
  );
}

// ── Batch Comparison Panel ────────────────────────────────────────────────────

function BatchComparisonPanel({ courses, selectedCourseId, onCourseChange, data, loading }: {
  courses: Course[];
  selectedCourseId: string;
  onCourseChange: (id: string) => void;
  data: BatchComparison | null;
  loading: boolean;
}) {
  return (
    <div style={{ ...glassCard, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 4px" }}>
            How You Compare
          </p>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 700, color: "#034852", margin: 0 }}>
            Batch Performance
          </h2>
        </div>
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.15)", background: "#fff", fontSize: "13px", fontWeight: 600, color: "#034852", cursor: "pointer", outline: "none" }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.4)", textAlign: "center", padding: "24px 0" }}>Loading…</p>
      ) : !data ? null : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "16px" }}>
          <ComparisonCard label="Course Batch" dim={data.course_batch} />
          {data.school_peers && <ComparisonCard label="School Peers" dim={data.school_peers} />}
          {data.programme_peers && <ComparisonCard label="Programme Peers" dim={data.programme_peers} />}
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ label, dim }: { label: string; dim: { peer_count: number; student_avg_pct: number; peer_avg_pct: number; percentile: number } }) {
  const diff = Math.round(dim.student_avg_pct - dim.peer_avg_pct);
  const diffColor = diff >= 0 ? "#0abe62" : "#e53e3e";
  const diffLabel = diff >= 0 ? `+${diff}%` : `${diff}%`;
  const pct = dim.percentile;

  return (
    <div style={{ background: "rgba(3,72,82,0.03)", borderRadius: "14px", padding: "18px", border: "1px solid rgba(3,72,82,0.07)" }}>
      <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(3,72,82,0.45)" }}>
        {label} · {dim.peer_count} student{dim.peer_count !== 1 ? "s" : ""}
      </p>

      {/* Your score vs avg */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "6px" }}>
        <span style={{ fontSize: "32px", fontWeight: 900, color: "#034852", lineHeight: 1 }}>{dim.student_avg_pct}%</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: diffColor }}>{diffLabel} vs avg</span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>
        Batch avg: {dim.peer_avg_pct}%
      </p>

      {/* Percentile bar */}
      <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 600, color: "#034852" }}>
        Top {100 - pct}% of batch
      </p>
      <div style={{ height: "6px", borderRadius: "100px", background: "rgba(3,72,82,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "100px", background: pct >= 70 ? "#0abe62" : pct >= 40 ? "#d97706" : "#e53e3e", transition: "width 0.6s ease" }} />
      </div>
      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.4)" }}>
        Better than {pct}% of peers
      </p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
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
