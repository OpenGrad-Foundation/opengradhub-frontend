"use client";

import { useEffect, useState } from "react";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { useRouter } from "next/navigation";
import { useSearchParams, usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getAvailableQuizzes, getModuleQuizzes, getMyQuizAttempts, getTopicStrength, getBatchComparison, getStudentEnrolments, type Quiz, type ModuleQuiz, type QuizAttempt, type TopicStrengthRow, type BatchComparison, type Course } from "@/lib/api";
import {
  type AssessmentsOverviewItem,
  getQuizLeaderboard,
  type QuizLeaderboard,
} from "@/lib/api";
import { useAssessmentsOverview } from "@/lib/queries/assessments";
import { useQuestionStats } from "@/lib/queries/quizzes";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const router = useRouter();

  const studentId      = data?.user?.id ?? "";

  // Admin-viewers (any analytics permission) go to the monitor view.
  const isAdminViewer = has(PERM.analytics.view)
                     || has(PERM.analytics.view_admin)
                     || has(PERM.analytics.view_manager)
                     || has(PERM.analytics.view_fellow);

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

  useEffect(() => {
    if (userLoading || !canAttempt || !studentId) return;
    setLoading(true);
    Promise.all([getAvailableQuizzes(), getModuleQuizzes()])
      .then(async ([globalQs, moduleQs]) => {
        setQuizzes(globalQs);
        setModuleQuizzes(moduleQs);
        // One batch attempts call instead of one-per-quiz, grouped by quiz_id.
        const allQs = [...globalQs, ...moduleQs];
        const byQuiz: Record<string, QuizAttempt[]> = {};
        for (const q of allQs) byQuiz[q.id] = [];
        const myAttempts = await getMyQuizAttempts(studentId).catch(() => [] as QuizAttempt[]);
        for (const a of myAttempts) {
          if (a.is_complete && byQuiz[a.quiz_id] !== undefined) byQuiz[a.quiz_id].push(a);
        }
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

  if (userLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  // ── Admin/Manager view ───────────────────────────────────────────────────
  if (isAdminViewer) {
    return <MonitorView />;
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
                    onPractice={() => router.push(`/dashboard/quiz/${q.id}/practice`)}
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
                    onPractice={() => router.push(`/dashboard/quiz/${q.id}/practice`)}
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
  quiz, label, attempts, onStart, onReview, onPractice,
}: {
  quiz: Omit<Quiz, "questions">;
  label: string;
  attempts: QuizAttempt[];
  onStart: () => void;
  onReview: (attemptId: string) => void;
  onPractice: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const maxAttempts  = quiz.max_attempts;
  const attemptsUsed = attempts.length;
  const exhausted    = maxAttempts != null && attemptsUsed >= maxAttempts;
  const showPractice = attemptsUsed > 0 && quiz.first_attempt_counts === true;

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
                {showPractice && (
                  <button
                    onClick={onPractice}
                    style={{ flexShrink: 0, padding: "5px 12px", border: "1px solid rgba(3,72,82,0.15)", borderRadius: "8px", background: "#fff", color: "#209379", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                  >
                    Practice →
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

// ── Monitor View ──────────────────────────────────────────────────────────────

function MonitorView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const type      = (params.get('type') as 'MODULE' | 'PROGRAM' | null) ?? null;
  const courseId  = params.get('course_id') ?? '';
  const bundleId  = params.get('bundle_id') ?? '';
  const from      = params.get('from') ?? '';
  const to        = params.get('to')   ?? '';
  const q         = params.get('q')    ?? '';
  const page      = Number(params.get('page') ?? '1');
  const drawerId  = params.get('drawer');

  const { data, isPending: loading, isError, error: queryError } = useAssessmentsOverview({
    type: type ?? undefined,
    course_id: courseId || undefined,
    bundle_id: bundleId || undefined,
    from: from || undefined,
    to:   to   || undefined,
    q:    q    || undefined,
    page,
    size: 20,
  });
  const error = isError ? (queryError instanceof Error ? queryError.message : 'Failed to load.') : null;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
    if (key !== 'page' && key !== 'drawer') next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div>
      <PageHeader />

      {/* Filter bar */}
      <div style={{ ...glassCard, marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <SegBtn label="All"     active={!type}              onClick={() => setParam('type', null)} />
          <SegBtn label="Module"  active={type === 'MODULE'}  onClick={() => setParam('type', 'MODULE')} />
          <SegBtn label="Program" active={type === 'PROGRAM'} onClick={() => setParam('type', 'PROGRAM')} />

          <input
            value={q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Search by title…"
            style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid rgba(3,72,82,0.15)', borderRadius: '8px', fontSize: '13px' }}
          />

          <input
            type="date" value={from} onChange={(e) => setParam('from', e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid rgba(3,72,82,0.15)', borderRadius: '8px', fontSize: '13px' }}
          />
          <input
            type="date" value={to}   onChange={(e) => setParam('to', e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid rgba(3,72,82,0.15)', borderRadius: '8px', fontSize: '13px' }}
          />

          <button
            onClick={() => router.replace(pathname)}
            style={{ padding: '8px 14px', border: '1px solid rgba(3,72,82,0.15)', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px' }}
          >Reset</button>
        </div>
      </div>

      {error && (
        <div style={{ ...glassCard, marginBottom: '20px', background: 'rgba(229,62,62,0.07)' }}>
          <p style={{ color: '#c53030', fontSize: '14px' }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ ...glassCard, textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'rgba(3,72,82,0.5)', fontSize: '14px' }}>Loading…</p>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div style={{ ...glassCard, textAlign: 'center', padding: '48px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#034852' }}>No assessments match your filters.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.items.map((item) => (
              <MonitorRow key={item.quiz_id} item={item} onClick={() => setParam('drawer', item.quiz_id)} />
            ))}
          </div>

          {data.total > data.size && (
            <Pagination page={data.page} size={data.size} total={data.total} onPage={(p) => setParam('page', String(p))} />
          )}
        </>
      )}

      {drawerId && <TestDrawer quizId={drawerId} onClose={() => setParam('drawer', null)} />}
    </div>
  );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: '8px',
        border: active ? '1px solid #0abe62' : '1px solid rgba(3,72,82,0.15)',
        background: active ? 'rgba(10,190,98,0.1)' : '#fff',
        color: active ? '#0abe62' : '#034852',
        fontWeight: 700, fontSize: '13px', cursor: 'pointer',
      }}
    >{label}</button>
  );
}

function MonitorRow({ item, onClick }: { item: AssessmentsOverviewItem; onClick: () => void }) {
  const lastAttempt = item.last_attempted_at
    ? new Date(item.last_attempted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
  const label = item.type === 'MODULE'
    ? `${item.course_title ?? ''} · Module Test`
    : item.bundle_title ? `${item.bundle_title} · Program` : 'Program Test';

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
        padding: '16px 20px',
        cursor: 'pointer',
      }}
    >
      <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.22em', color: '#209379' }}>
        {label}
      </p>
      <h3 style={{ margin: '3px 0 8px', fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: '#034852' }}>
        {item.title}
      </h3>
      <p style={{ margin: 0, fontSize: '13px', color: 'rgba(3,72,82,0.7)' }}>
        {item.students_attempted} students · {item.attempts_count} attempts ·
        {' '}avg {item.avg_score_pct == null ? '—' : `${item.avg_score_pct}%`} ·
        {' '}{item.pass_rate_pct == null ? '—' : `${item.pass_rate_pct}% pass`} ·
        {' '}last: {lastAttempt}
      </p>
    </button>
  );
}

function Pagination({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (n: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '20px' }}>
      <button disabled={page <= 1}          onClick={() => onPage(page - 1)} style={pageBtnStyle(page > 1)}>‹</button>
      <span style={{ padding: '6px 12px', fontSize: '13px', color: '#034852' }}>{page} / {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} style={pageBtnStyle(page < totalPages)}>›</button>
    </div>
  );
}

function pageBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    border: '1px solid rgba(3,72,82,0.15)',
    borderRadius: '8px',
    background: enabled ? '#fff' : 'rgba(3,72,82,0.04)',
    color: enabled ? '#034852' : 'rgba(3,72,82,0.3)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 700, fontSize: '13px',
  };
}

function TestDrawer({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'leaderboard' | 'questions'>('leaderboard');

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(3,72,82,0.4)', zIndex: 50 }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
        background: '#fff', boxShadow: '-8px 0 24px rgba(0,0,0,0.1)',
        zIndex: 51, display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(3,72,82,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#034852' }}>Test Details</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#034852' }}>×</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(3,72,82,0.08)' }}>
          <DrawerTab label="Leaderboard"    active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} />
          <DrawerTab label="Question Stats" active={tab === 'questions'}   onClick={() => setTab('questions')} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {tab === 'leaderboard' ? <DrawerLeaderboard quizId={quizId} /> : <DrawerQuestionStats quizId={quizId} />}
        </div>
      </div>
    </>
  );
}

function DrawerTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 0', background: 'none', border: 'none',
        borderBottom: active ? '2px solid #0abe62' : '2px solid transparent',
        color: active ? '#0abe62' : 'rgba(3,72,82,0.6)',
        fontWeight: 700, fontSize: '13px', cursor: 'pointer',
      }}
    >{label}</button>
  );
}

function DrawerLeaderboard({ quizId }: { quizId: string }) {
  const [data, setData]   = useState<QuizLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(null);
    getQuizLeaderboard(quizId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.'); });
    return () => { cancelled = true; };
  }, [quizId]);

  if (error) return <p style={{ color: '#c53030', fontSize: '13px' }}>{error}</p>;
  if (data === null) return <p style={{ color: 'rgba(3,72,82,0.4)', fontSize: '13px' }}>Loading…</p>;
  if (data.rankings.length === 0) return <p style={{ color: 'rgba(3,72,82,0.4)', fontSize: '13px' }}>No completed attempts yet.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid rgba(3,72,82,0.08)' }}>
          <th style={{ textAlign: 'left',  padding: '8px 4px', color: 'rgba(3,72,82,0.6)', fontWeight: 700 }}>#</th>
          <th style={{ textAlign: 'left',  padding: '8px 4px', color: 'rgba(3,72,82,0.6)', fontWeight: 700 }}>Student</th>
          <th style={{ textAlign: 'right', padding: '8px 4px', color: 'rgba(3,72,82,0.6)', fontWeight: 700 }}>Score</th>
          <th style={{ textAlign: 'right', padding: '8px 4px', color: 'rgba(3,72,82,0.6)', fontWeight: 700 }}>Date</th>
        </tr>
      </thead>
      <tbody>
        {data.rankings.slice(0, 50).map((r) => (
          <tr key={r.student_id} style={{ borderBottom: '1px solid rgba(3,72,82,0.04)' }}>
            <td style={{ padding: '8px 4px', color: '#034852', fontWeight: 700 }}>{r.rank}</td>
            <td style={{ padding: '8px 4px', color: '#034852' }}>{r.name}</td>
            <td style={{ padding: '8px 4px', color: '#034852', textAlign: 'right', fontWeight: 700 }}>
              {r.score_pct}%
              <span style={{ marginLeft: 4, color: 'rgba(3,72,82,0.45)', fontWeight: 400 }}>({r.correct_count})</span>
            </td>
            <td style={{ padding: '8px 4px', color: 'rgba(3,72,82,0.5)', textAlign: 'right' }}>
              {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DrawerQuestionStats({ quizId }: { quizId: string }) {
  const { data: stats, isPending, isError, error: queryError } = useQuestionStats(quizId);

  if (isError) return <p style={{ color: '#c53030', fontSize: '13px' }}>{queryError instanceof Error ? queryError.message : 'Failed to load.'}</p>;
  if (isPending || stats === undefined) return <p style={{ color: 'rgba(3,72,82,0.4)', fontSize: '13px' }}>Loading…</p>;
  if (stats.length === 0) return <p style={{ color: 'rgba(3,72,82,0.4)', fontSize: '13px' }}>No attempt data yet.</p>;

  // Sort weakest-first by correct ratio
  const sorted = [...stats].sort((a, b) => {
    const aTotal = a.total_attempts || 1;
    const bTotal = b.total_attempts || 1;
    return (a.correct_count / aTotal) - (b.correct_count / bTotal);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {sorted.map((s, idx) => {
        const total = s.total_attempts || 1;
        const pctCorrect = Math.round((s.correct_count / total) * 100);
        return (
          <div key={s.snapshot_id}>
            <div style={{ margin: '0 0 4px', fontSize: '13px', color: '#034852' }}>
              <span style={{ fontWeight: 700, marginRight: 6 }}>Q{idx + 1}</span>
              <MathContent html={s.content_html} />
            </div>
            <div style={{ display: 'flex', height: '8px', borderRadius: '100px', overflow: 'hidden', background: 'rgba(3,72,82,0.06)' }}>
              <div style={{ width: `${(s.correct_count / total) * 100}%`, background: '#0abe62' }} />
              <div style={{ width: `${(s.wrong_count   / total) * 100}%`, background: '#e53e3e' }} />
              <div style={{ width: `${(s.skipped_count / total) * 100}%`, background: 'rgba(3,72,82,0.2)' }} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(3,72,82,0.5)' }}>
              {pctCorrect}% correct · {s.correct_count}/{total} ·
              {' '}avg time {s.avg_time_correct_seconds == null ? '—' : `${s.avg_time_correct_seconds}s`}
              {s.subject ? ` · ${s.subject}${s.topic ? ` / ${s.topic}` : ''}` : ''}
            </p>
          </div>
        );
      })}
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
