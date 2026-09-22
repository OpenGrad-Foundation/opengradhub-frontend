"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { StaffReportsView } from "@/components/reports/StaffReportsView";
import {
  getAvailableQuizzes,
  getModuleQuizzes,
  getMyQuizAttempts,
  getStudentEnrolments,
  downloadStudentMonthlyReportPdf,
  downloadStudentCourseReportPdf,
  downloadStudentTestReportPdf,
  type Course,
  type StudentReportPdf,
} from "@/lib/api";
import { useReportHistory } from "@/lib/queries/reports";
import { PerformanceHistoryTable } from "@/components/performance-history-table";
import { Download } from "lucide-react";

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

type Scope = "month" | "course" | "test";

// A quiz the student has completed at least once — eligible for a test report.
type CompletedQuiz = { id: string; title: string };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { isLoading: userLoading } = useCurrentUser();
  const perms = usePermissions();
  const isStaffReportsUser = perms.hasAny(
    "analytics.view_fellow",
    "analytics.view_manager",
    "analytics.view_admin",
  );
  const canUseStudentReports = perms.has("reports.view");

  const [scope, setScope] = useState<Scope>("month");

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const [completedQuizzes, setCompletedQuizzes] = useState<CompletedQuiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>("");

  const [picklistsLoading, setPicklistsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the student's full performance history (every completed attempt with
  // per-subject scores + ranks). Backend scopes to the caller ("me").
  const {
    data: historyData,
    isPending: historyLoading,
    isError: historyIsError,
    error: historyErrorObj,
  } = useReportHistory("me");
  const historyRows = historyData?.rows ?? [];
  const historyError = historyIsError
    ? historyErrorObj instanceof Error
      ? historyErrorObj.message
      : "Failed to load performance history."
    : null;

  // Load the student's enrolled courses and the quizzes they have completed at
  // least once. Quizzes come from both the global/program list and the module
  // list; a quiz is eligible for a test report only if it has ≥1 completed
  // attempt — mirroring how the assessments page filters attempts.
  useEffect(() => {
    if (userLoading || perms.isLoading || isStaffReportsUser || !canUseStudentReports) return;
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setPicklistsLoading(true);
    }, 0);

    Promise.all([
      getStudentEnrolments("me").catch(() => [] as Course[]),
      getAvailableQuizzes().catch(() => []),
      getModuleQuizzes().catch(() => []),
      getMyQuizAttempts().catch(() => []),
    ])
      .then(([enrolments, globalQs, moduleQs, myAttempts]) => {
        if (cancelled) return;
        setCourses(enrolments);
        if (enrolments.length > 0) setSelectedCourseId(enrolments[0].id);

        // One batch attempts call instead of one-per-quiz: a quiz is eligible
        // for a test report if it has >=1 complete attempt.
        const completedQuizIds = new Set(
          myAttempts.filter((a) => a.is_complete).map((a) => a.quiz_id),
        );
        const allQs = [...globalQs, ...moduleQs];
        const completed: CompletedQuiz[] = allQs
          .filter((q) => completedQuizIds.has(q.id))
          .map((q) => ({ id: q.id, title: q.title }));

        setCompletedQuizzes(completed);
        if (completed.length > 0) setSelectedQuizId(completed[0].id);
      })
      .finally(() => {
        if (!cancelled) setPicklistsLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [userLoading, perms.isLoading, isStaffReportsUser, canUseStudentReports]);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      if (scope === "month") {
        openPdf(await downloadStudentMonthlyReportPdf("me"));
      } else if (scope === "course") {
        if (!selectedCourseId) return;
        openPdf(await downloadStudentCourseReportPdf("me", selectedCourseId));
      } else {
        if (!selectedQuizId) return;
        openPdf(await downloadStudentTestReportPdf("me", selectedQuizId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download report.");
    } finally {
      setDownloading(false);
    }
  }

  if (userLoading || perms.isLoading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>Loading…</p>
      </div>
    );
  }

  if (isStaffReportsUser) {
    return <StaffReportsView />;
  }

  if (!canUseStudentReports) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--color-text-muted)", fontSize: "14px" }}>
          You don&apos;t have access to reports.
        </p>
      </div>
    );
  }

  const downloadDisabled =
    downloading ||
    (scope === "course" && !selectedCourseId) ||
    (scope === "test" && !selectedQuizId);

  return (
    <div>
      {error && (
        <div style={{ ...card, marginBottom: "20px", padding: "16px 20px", background: "rgba(184,50,50,0.06)", border: "1px solid rgba(184,50,50,0.25)" }}>
          <p style={{ color: "#b83232", fontSize: "14px", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Generate a report */}
      <div style={card}>
        <p style={sectionTitle}>
          Generate a report
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
          {/* Scope selector */}
          <label style={fieldLabel}>
            Report scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              style={selectStyle}
            >
              <option value="month">This month</option>
              <option value="course">By course</option>
              <option value="test">By quiz</option>
            </select>
          </label>

          {/* Course selector */}
          {scope === "course" && (
            <label style={fieldLabel}>
              Course
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={picklistsLoading || courses.length === 0}
                style={selectStyle}
              >
                {picklistsLoading ? (
                  <option value="">Loading courses…</option>
                ) : courses.length === 0 ? (
                  <option value="">No courses</option>
                ) : (
                  courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}

          {/* Test selector */}
          {scope === "test" && (
            <label style={fieldLabel}>
              Quiz
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                disabled={picklistsLoading || completedQuizzes.length === 0}
                style={selectStyle}
              >
                {picklistsLoading ? (
                  <option value="">Loading quizzes…</option>
                ) : completedQuizzes.length === 0 ? (
                  <option value="">No completed quizzes yet</option>
                ) : (
                  completedQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}

          {/* Download CTA */}
          <button
            onClick={handleDownload}
            disabled={downloadDisabled}
            style={{
              ...primaryBtn,
              minHeight: "44px",
              opacity: downloadDisabled ? 0.55 : 1,
              cursor: downloadDisabled ? "not-allowed" : "pointer",
            }}
          >
            <Download size={16} aria-hidden="true" />
            {downloading ? "Preparing…" : "Download report (PDF)"}
          </button>
        </div>

        {/* Inline hints for empty pick-lists */}
        {scope === "course" && !picklistsLoading && courses.length === 0 && (
          <p style={hintText}>You are not enrolled in any courses yet.</p>
        )}
        {scope === "test" && !picklistsLoading && completedQuizzes.length === 0 && (
          <p style={hintText}>Complete a quiz to generate a quiz report.</p>
        )}
      </div>

      {/* Performance History */}
      <div style={{ ...card, marginTop: "24px" }}>
        <p style={sectionTitle}>
          Performance history
        </p>

        {historyLoading ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "14px", margin: "12px 0 0" }}>Loading…</p>
        ) : historyError ? (
          <p style={{ color: "#b83232", background: "rgba(184,50,50,0.06)", padding: "8px 12px", borderRadius: "8px", fontSize: "14px", margin: "12px 0 0" }}>
            {historyError}
          </p>
        ) : historyRows.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: "14px", margin: "12px 0 0" }}>No completed attempts yet.</p>
        ) : (
          <PerformanceHistoryTable rows={historyRows} />
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "var(--color-text)",
  margin: "0 0 16px",
};

const primaryBtn: React.CSSProperties = {
  padding: "0 18px",
  border: "1px solid var(--green)",
  borderRadius: "12px",
  background: "var(--green)",
  color: "var(--dark-teal)",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
};

const selectStyle: React.CSSProperties = {
  minWidth: "220px",
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-surface)",
  fontSize: "14px",
  color: "var(--color-text)",
  cursor: "pointer",
};

const hintText: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: "13px",
  color: "var(--color-text-muted)",
};
