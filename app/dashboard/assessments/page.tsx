"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Plus, ArrowRight, X } from "lucide-react";
import { Tabs } from "@/app/dashboard/_components/Tabs";
import { PaginationBar } from "@/app/dashboard/_components/PaginationBar";
import catalogue from "@/app/dashboard/_components/catalogue.module.css";
import workspace from "@/components/dashboard/workspace.module.css";
import styles from "./assessments.module.css";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { useRouter } from "next/navigation";
import { useSearchParams, usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { hasEffectiveSelfScope, PERM } from "@/lib/permissions";
import { getAvailableQuizzes, getModuleQuizzes, getMyQuizAttempts, getTopicStrength, getBatchComparison, getStudentEnrolments, type Quiz, type AvailableQuiz, type ModuleQuiz, type QuizAttempt, type TopicStrengthRow, type BatchComparison, type Course } from "@/lib/api";
import {
  type AssessmentsOverviewItem,
  getQuizLeaderboard,
  type QuizLeaderboard,
} from "@/lib/api";
import { useAssessmentsOverview } from "@/lib/queries/assessments";
import { useBatches } from "@/lib/queries/batches";
import { useProgrammes } from "@/lib/queries/programmes";
import { useQuestionStats, useAllQuizAttempts, useDeleteQuizAttempt } from "@/lib/queries/quizzes";
import type { QuizAttemptWithStudent } from "@/lib/api";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssessmentsPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const router = useRouter();
  const currentUrl = useCurrentUrl();

  const studentId      = data?.user?.id ?? "";

  const isLearner = hasEffectiveSelfScope(data?.permissions ?? []);
  const canViewOwn = isLearner && has(PERM.assessments.view);
  const isAdminViewer = !isLearner && has(PERM.students.view) && (has(PERM.analytics.view)
                     || has(PERM.analytics.view_admin)
                     || has(PERM.analytics.view_manager)
                     || has(PERM.analytics.view_fellow));

  const canAttempt = canViewOwn && has(PERM.assessments.attempt);

  const [quizzes, setQuizzes]           = useState<AvailableQuiz[]>([]);
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
    if (userLoading || !canViewOwn || !studentId) return;
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
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load quizzes."))
      .finally(() => setLoading(false));
  }, [userLoading, canViewOwn, studentId]);

  useEffect(() => {
    if (!canViewOwn || !selectedCourseId || !studentId) return;
    setBatchLoading(true);
    setBatchComparison(null);
    getBatchComparison(studentId, selectedCourseId)
      .then(setBatchComparison)
      .catch(() => {})
      .finally(() => setBatchLoading(false));
  }, [canViewOwn, selectedCourseId, studentId]);

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

  if (!canViewOwn) {
    return <div><PageHeader /><p className="text-sm text-slate-600">Assessment monitoring requires View Students and an analytics permission. Your assigned quizzes are available with Self scope and View Assessments permission.</p></div>;
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
          <p style={{ color: "rgba(3,72,82,0.5)", fontSize: "14px" }}>Loading your quizzes…</p>
        </div>
      ) : quizzes.length === 0 && moduleQuizzes.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
            No Quizzes Yet
          </p>
          <p style={{ fontSize: "16px", fontWeight: 700, color: "#034852" }}>No quizzes assigned to you yet</p>
          <p style={{ marginTop: "8px", fontSize: "14px", color: "rgba(3,72,82,0.6)", maxWidth: "380px", margin: "8px auto 0" }}>
            Quizzes will appear here once you are enrolled in courses with module quizzes or program bundles.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {/* Module tests */}
          {moduleQuizzes.length > 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 14px" }}>
                Module Quizzes
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {moduleQuizzes.map((q) => (
                  <QuizRow
                    key={q.id}
                    quiz={q}
                    canAttempt={canAttempt}
                    label={`${q.course_title} · ${q.module_title}`}
                    attempts={attemptsByQuiz[q.id] ?? []}
                    locked={q.is_locked === true}
                    onStart={() => router.push(withFrom(`/dashboard/quiz/${q.id}`, currentUrl))}
                    onReview={(attemptId) => router.push(withFrom(`/dashboard/quiz/${q.id}/review/${attemptId}`, currentUrl))}
                    onPractice={() => router.push(withFrom(`/dashboard/quiz/${q.id}/practice`, currentUrl))}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Global / program tests */}
          {quizzes.length > 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 14px" }}>
                Program Quizzes
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {quizzes.map((q) => (
                  <QuizRow
                    key={q.id}
                    quiz={q}
                    canAttempt={canAttempt}
                    label="Global Quiz"
                    attempts={attemptsByQuiz[q.id] ?? []}
                    locked={q.attemptable === false}
                    missed={q.missed === true}
                    lockedTitle={
                      q.available_from && new Date(q.available_from) > new Date()
                        ? `Opens ${new Date(q.available_from).toLocaleString()}`
                        : q.due_at && new Date(q.due_at) <= new Date()
                          ? `Due date passed (${new Date(q.due_at).toLocaleString()})`
                          : undefined
                    }
                    windowInfo={
                      q.attemptable === false && q.available_from && new Date(q.available_from) > new Date()
                        ? `Opens ${new Date(q.available_from).toLocaleDateString()}`
                        : q.due_at
                          ? new Date(q.due_at) > new Date()
                            ? `Due ${new Date(q.due_at).toLocaleDateString()}`
                            : "Past due"
                          : undefined
                    }
                    onStart={() => router.push(withFrom(`/dashboard/quiz/${q.id}`, currentUrl))}
                    onReview={(attemptId) => router.push(withFrom(`/dashboard/quiz/${q.id}/review/${attemptId}`, currentUrl))}
                    onPractice={() => router.push(withFrom(`/dashboard/quiz/${q.id}/practice`, currentUrl))}
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
  quiz, label, attempts, canAttempt, locked, lockedTitle, windowInfo, missed, onStart, onReview, onPractice,
}: {
  quiz: Omit<Quiz, "questions">;
  label: string;
  attempts: QuizAttempt[];
  canAttempt: boolean;
  /** Module test gated by sequential flow, or batch test outside its window. */
  locked?: boolean;
  /** Tooltip for the disabled Start button (defaults to the module-lock hint). */
  lockedTitle?: string;
  /** Optional “Opens …” / “Due …” badge for batch-windowed tests. */
  windowInfo?: string;
  /** Past due and never completed — takes the window badge's place. */
  missed?: boolean;
  onStart: () => void;
  onReview: (attemptId: string) => void;
  onPractice: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // 0 / null / empty all mean "unlimited" — coerce any non-positive limit to
  // null here so `exhausted` and the attempts pill below treat it as unlimited.
  const maxAttempts  = quiz.max_attempts != null && quiz.max_attempts > 0 ? quiz.max_attempts : null;
  const attemptsUsed = attempts.length;
  const exhausted    = maxAttempts != null && maxAttempts > 0 && attemptsUsed >= maxAttempts;
  const isLocked     = locked === true;
  const showPractice = canAttempt && attemptsUsed > 0 && quiz.first_attempt_counts === true;

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
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 lg:px-5 lg:py-4">
        <div className="flex items-center gap-[14px] flex-1 min-w-0">
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
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3 shrink-0 w-full lg:w-auto pl-[38px] lg:pl-0">
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
            {/* A missed quiz is past due with nothing to show for it — the neutral
                "Past due" window badge would read the same as one they actually sat. */}
            {missed ? (
              <Pill style={{ background: "rgba(229,62,62,0.1)", color: "#c53030" }}>⚠ Missed</Pill>
            ) : windowInfo ? (
              <Pill style={{ background: "rgba(255,222,0,0.18)", color: "#956f00" }}>🗓 {windowInfo}</Pill>
            ) : null}
            {quiz.duration_minutes != null && <Pill>⏱ {quiz.duration_minutes} min</Pill>}
            {maxAttempts != null && maxAttempts > 0 ? (
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

          {canAttempt && <button
            onClick={onStart}
            disabled={exhausted || isLocked}
            title={isLocked ? (lockedTitle ?? "Complete the module's lessons (and any prior modules) in the course to unlock this quiz") : undefined}
            className="w-full lg:w-auto mt-1 lg:mt-0"
            style={{
              flexShrink: 0,
              padding: "9px 18px", border: "none", borderRadius: "10px",
              background: exhausted || isLocked
                ? "rgba(3,72,82,0.08)"
                : "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
              color: exhausted || isLocked ? "rgba(3,72,82,0.35)" : "#fff",
              fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
              cursor: exhausted || isLocked ? "default" : "pointer",
              boxShadow: exhausted || isLocked ? "none" : "0 4px 12px rgba(10,190,98,0.2)",
            }}
          >
            {isLocked ? "🔒 Locked" : exhausted ? "No attempts left" : attemptsUsed > 0 ? "Retake" : "Start"}
          </button>}
        </div>
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
  const { has } = usePermissions();
  const router = useRouter();
  return (
    <div style={{ ...glassCard, marginBottom: "28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", marginBottom: "8px" }}>
            Quizzes
          </p>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, color: "#034852", margin: 0 }}>
            Quizzes
          </h1>
        </div>
        {has(PERM.test_bank.create) && (
          <button
            type="button"
            onClick={() => router.push("/dashboard/quiz-builder/new")}
            style={{
              flexShrink: 0, padding: "10px 18px", border: "none", borderRadius: "12px",
              background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
              color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
              cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap",
            }}
          >
            + Create Program Quiz
          </button>
        )}
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
          {data.cohort_batch && <ComparisonCard label={`My Batch · ${data.cohort_batch.batch_name}`} dim={data.cohort_batch} />}
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

  const rawType = params.get('type');
  const type = rawType === 'MODULE' || rawType === 'PROGRAM' ? rawType : null;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const courseId  = params.get('course_id') ?? '';
  const bundleId  = params.get('bundle_id') ?? '';
  const batchId   = params.get('batch_id') ?? '';
  const from      = params.get('from') ?? '';
  const to        = params.get('to')   ?? '';
  const q           = params.get('q')    ?? '';
  const programmeId = params.get('programme_id') ?? '';
  const rawPage = Number(params.get('page') ?? '1');
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const drawerId    = params.get('drawer');

  const { has } = usePermissions();
  const canReadBatches = has(PERM.batches.view);
  const canReadProgrammes = has(PERM.programmes.view);
  const batchQuery = useBatches('ACTIVE', canReadBatches);
  const programmeQuery = useProgrammes(false, canReadProgrammes);
  const batches = canReadBatches ? batchQuery.data ?? [] : [];
  const allProgrammes = canReadProgrammes ? programmeQuery.data ?? [] : [];
  // The API resolves operational reach. A direct seat must not widen it, and
  // filtering on membership would hide assigned-batch access from nonmembers.
  const isUnrestricted = has(PERM.scope.unrestricted);
  const myProgrammes = allProgrammes;
  const inProgrammeMode = !isUnrestricted && myProgrammes.length > 0;
  const showPicker = myProgrammes.length > 0;

  const { data, isPending: loading, isError, error: queryError, refetch } = useAssessmentsOverview({
    type: type ?? undefined,
    course_id: courseId || undefined,
    bundle_id: bundleId || undefined,
    batch_id: batchId || undefined,
    programme_id: programmeId || undefined,
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
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const filterCount = [courseId, bundleId, batchId, programmeId, from, to].filter(Boolean).length;
  const currentUrl = useCurrentUrl();
  const clearFilters = () => {
    const next = new URLSearchParams(params.toString());
    ['course_id', 'bundle_id', 'batch_id', 'programme_id', 'from', 'to', 'q', 'page'].forEach(key => next.delete(key));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const content = <div className={catalogue.content}>
    <div className={catalogue.toolbar}>
      <div className={catalogue.searchTools}>
        <label className={catalogue.search}><Search size={18} aria-hidden="true" /><input type="search" aria-label="Search quizzes" placeholder="Search quizzes…" value={q} onChange={event => setParam('q', event.target.value)} /></label>
        <button className={catalogue.secondary} aria-expanded={filtersOpen} aria-controls="quiz-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={18} aria-hidden="true" />Filters{filterCount > 0 && <span className={catalogue.count}>{filterCount}</span>}</button>
      </div>
      <div className={catalogue.actions}>
        {has(PERM.test_bank.view) && <Link className={catalogue.secondary} href="/dashboard/test-bank?tab=quizzes">Manage quizzes</Link>}
        {has(PERM.test_bank.create) && <Link className={catalogue.primary} href={withFrom('/dashboard/quiz-builder/new', currentUrl)}><Plus size={18} aria-hidden="true" />New quiz</Link>}
      </div>
    </div>
    {filtersOpen && <div id="quiz-filters" className={catalogue.filters}>
      {showPicker && <label className={catalogue.field}>Programme<select className={catalogue.control} value={programmeId} onChange={e => setParam('programme_id', e.target.value)}><option value="">{isUnrestricted ? 'All programmes' : 'All my programmes'}</option>{myProgrammes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      {batches.length > 0 && <label className={catalogue.field}>Batch<select className={catalogue.control} value={batchId} onChange={e => setParam('batch_id', e.target.value)}><option value="">All batches</option>{batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <label className={catalogue.field}>From<input className={catalogue.control} type="date" value={from} onChange={e => setParam('from', e.target.value)} /></label>
      <label className={catalogue.field}>To<input className={catalogue.control} type="date" value={to} min={from || undefined} onChange={e => setParam('to', e.target.value)} /></label>
    </div>}
    <div className={catalogue.resultsLabel} aria-live="polite"><span>{loading ? 'Loading quizzes…' : `${data?.total ?? 0} quizzes`}</span>{(q || filterCount > 0) && <button className={catalogue.clearFilters} onClick={clearFilters}>Clear filters</button>}</div>
    {error ? <div className={catalogue.empty} role="alert"><h2>Couldn’t load quizzes</h2><p>{error}</p><button className={catalogue.secondary} onClick={() => void refetch()}>Try again</button></div>
      : loading ? <div aria-label="Loading quizzes" className={styles.list}>{[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}</div>
      : !data || data.items.length === 0 ? <div className={catalogue.empty}><h2>{q || filterCount ? 'No matching quizzes' : 'No quizzes to monitor yet'}</h2><p>{q || filterCount ? 'Try a different search or clear your filters.' : inProgrammeMode ? 'No published quizzes are available from this programme’s courses yet.' : 'Published quizzes and student attempts will appear here.'}</p>{inProgrammeMode && has(PERM.programmes.view) && <Link className={catalogue.secondary} href={`/dashboard/programmes/${programmeId || myProgrammes[0]?.id || ''}?tab=content`}>Open programme content<ArrowRight size={16} aria-hidden="true" /></Link>}</div>
      : <div className={styles.list}>{data.items.map(item => <MonitorRow key={item.quiz_id} item={item} onClick={() => setParam('drawer', item.quiz_id)} />)}</div>}
    {!error && data && <PaginationBar currentPage={data.page} totalPages={Math.ceil(data.total / data.size)} onPageChange={p => setParam('page', String(p))} ariaLabel="Quiz pages" />}
  </div>;
  const tabs = [{key:'ALL',label:'All quizzes',panel:content},{key:'MODULE',label:'Module quizzes',compactLabel:'Modules',panel:content},...(!inProgrammeMode ? [{key:'PROGRAM',label:'Programme quizzes',compactLabel:'Programme',panel:content}] : [])];
  return <div className={`${workspace.workspace} ${catalogue.catalogue} ${styles.page}`}>
    <div className={workspace.stickyTabs}><Tabs ariaLabel="Quiz types" compactOnScroll tabs={tabs} activeKey={type ?? 'ALL'} onTabChange={key => setParam('type', key === 'ALL' ? null : key)} /></div>
    {drawerId && <TestDrawer quizId={drawerId} onClose={() => setParam('drawer', null)} />}
  </div>;
}

function MonitorRow({ item, onClick }: { item: AssessmentsOverviewItem; onClick: () => void }) {
  const context = [item.programme_name, item.type === 'MODULE' ? item.course_title : item.bundle_title].filter(Boolean).join(' · ');
  return <button onClick={onClick} className={styles.quizRow}>
    <span className={styles.identity}><span className={styles.eyebrow}>{item.type === 'MODULE' ? 'Module quiz' : 'Programme quiz'}{context && ` · ${context}`}</span><span className={styles.title}>{item.title}</span><span className={styles.meta}>{item.duration_minutes != null ? `${item.duration_minutes} min · ` : ''}{item.attempts_count} attempts · {item.last_attempted_at ? `Last attempt ${new Date(item.last_attempted_at).toLocaleDateString('en-IN', {day:'numeric',month:'short'})}` : 'No attempts yet'}</span></span>
    <span className={styles.metrics}><span><strong>{item.students_attempted}</strong><span>Students</span></span><span><strong>{item.avg_score_pct == null ? '—' : `${item.avg_score_pct}%`}</strong><span>Avg. score</span></span><span><strong>{item.pass_rate_pct == null ? '—' : `${item.pass_rate_pct}%`}</strong><span>Pass rate</span></span></span>
    <span className={styles.open}><span>View results</span><ArrowRight size={18} aria-hidden="true" /></span>
  </button>;
}

function TestDrawer({ quizId, onClose }: { quizId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'leaderboard' | 'questions' | 'attempts'>('leaderboard');
  const { has } = usePermissions();
  const router = useRouter();
  const currentUrl = useCurrentUrl();

  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);

  return (
      <dialog ref={dialogRef} className={styles.drawer} aria-labelledby="quiz-details-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.drawerInner}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(3,72,82,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="quiz-details-title" style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#034852' }}>Quiz Details</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {has(PERM.test_bank.edit) && (
              <button
                onClick={() => router.push(withFrom(`/dashboard/quiz-builder/${quizId}`, currentUrl))}
                className={catalogue.primary}
              >
                Edit in Builder →
              </button>
            )}
            <button onClick={onClose} aria-label="Close quiz details" className={catalogue.secondary}><X size={18} aria-hidden="true" /></button>
          </div>
        </div>

        <div className={styles.drawerTabs}>
          <DrawerTab label="Leaderboard"    active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} />
          <DrawerTab label="Question Stats" active={tab === 'questions'}   onClick={() => setTab('questions')} />
          <DrawerTab label="Attempts"       active={tab === 'attempts'}    onClick={() => setTab('attempts')} />
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {tab === 'leaderboard' && <DrawerLeaderboard quizId={quizId} />}
          {tab === 'questions'   && <DrawerQuestionStats quizId={quizId} />}
          {tab === 'attempts'    && <DrawerAttempts quizId={quizId} />}
        </div>
      </div>
      </dialog>
  );
}

function DrawerTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={catalogue.viewButton}
      aria-pressed={active}
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

type StudentAttemptGroup = {
  student_id: string;
  student_name: string;
  roll_number: string | null;
  attempts: QuizAttemptWithStudent[];
};

function DrawerAttempts({ quizId }: { quizId: string }) {
  const { data: attempts, isPending, isError, error: queryError } = useAllQuizAttempts(quizId);
  const { has } = usePermissions();
  const deleteAttempt = useDeleteQuizAttempt();

  if (isError) return <p style={{ color: '#c53030', fontSize: '13px' }}>{queryError instanceof Error ? queryError.message : 'Failed to load.'}</p>;
  if (isPending || attempts === undefined) return <p style={{ color: 'rgba(3,72,82,0.4)', fontSize: '13px' }}>Loading…</p>;
  if (attempts.length === 0) return <p style={{ color: 'rgba(3,72,82,0.4)', fontSize: '13px' }}>No attempts yet.</p>;

  const groups = Object.values(attempts.reduce((acc, a) => {
    if (!acc[a.student_id]) {
      acc[a.student_id] = {
        student_id: a.student_id,
        student_name: a.student_name,
        roll_number: a.roll_number,
        attempts: [],
      };
    }
    acc[a.student_id].attempts.push(a);
    return acc;
  }, {} as Record<string, StudentAttemptGroup>));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {groups.map((group) => (
        <DrawerAttemptsGroup
          key={group.student_id}
          group={group}
          quizId={quizId}
          canDelete={has(PERM.assessments.edit)}
          onDelete={(attemptId) => deleteAttempt.mutate(attemptId)}
          deletingId={deleteAttempt.isPending ? (deleteAttempt.variables as string | undefined) : undefined}
        />
      ))}
    </div>
  );
}

function DrawerAttemptsGroup({ group, quizId, canDelete, onDelete, deletingId }: {
  group: StudentAttemptGroup;
  quizId: string;
  canDelete: boolean;
  onDelete: (attemptId: string) => void;
  deletingId: string | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const currentUrl = useCurrentUrl();

  return (
    <div style={{ border: '1px solid rgba(3,72,82,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', background: expanded ? 'rgba(3,72,82,0.03)' : 'transparent',
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#034852' }}>{group.student_name}</p>
          {group.roll_number && <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(3,72,82,0.5)' }}>{group.roll_number}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(3,72,82,0.5)' }}>
            {group.attempts.length} {group.attempts.length === 1 ? 'attempt' : 'attempts'}
          </span>
          <button style={{ padding: '4px 10px', background: 'rgba(32,147,121,0.08)', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 700, color: '#209379', cursor: 'pointer' }}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(3,72,82,0.08)' }}>
          {group.attempts.map((a) => (
            <div
              key={a.id}
              style={{
                padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(3,72,82,0.04)', fontSize: '12px',
              }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#034852' }}>Attempt {a.attempt_number}</span>
                <span style={{ marginLeft: 8, color: 'rgba(3,72,82,0.5)' }}>
                  {a.is_complete
                    ? `${a.score ?? '—'}/${a.max_score ?? '—'}`
                    : 'In progress'}
                </span>
                {a.submitted_at && (
                  <span style={{ marginLeft: 8, color: 'rgba(3,72,82,0.4)' }}>
                    {new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {a.is_complete && (
                  <button
                    onClick={() => router.push(withFrom(`/dashboard/quiz/${quizId}/review/${a.id}`, currentUrl))}
                    style={{
                      padding: '4px 10px', border: 'none', borderRadius: '6px',
                      background: 'rgba(32,147,121,0.1)', color: '#209379', fontSize: '11px', fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    View
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => {
                      if (!confirm(`Delete attempt ${a.attempt_number} for ${group.student_name}? This lets them retry and cannot be undone.`)) return;
                      onDelete(a.id);
                    }}
                    disabled={deletingId === a.id}
                    style={{
                      padding: '4px 10px', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '6px',
                      background: 'transparent', color: '#dc2626', fontSize: '11px', fontWeight: 700,
                      cursor: deletingId === a.id ? 'not-allowed' : 'pointer', opacity: deletingId === a.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === a.id ? 'Deleting…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
