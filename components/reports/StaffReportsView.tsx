"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getAnalyticsSchools,
  getAnalyticsStudentsPaged,
  getStudentCourses,
  downloadStudentCourseReportPdf,
  downloadStudentMonthlyReportPdf,
  downloadStudentFullReportPdf,
  downloadStudentTestReportPdf,
  startBulkReport,
  getBulkReportStatus,
  downloadBulkReport,
  type AnalyticsSchool,
  type AnalyticsStudent,
  type StudentCourse,
  type StudentReportPdf,
  type PerformanceHistoryRow,
} from "@/lib/api";
import { useReportHistory } from "@/lib/queries/reports";

// ─── Fellow dashboard ─────────────────────────────────────────────────────────
// Lists the students in the fellow's scope (the visible set is derived
// server-side from the JWT) and exposes a per-student "Reports" menu that
// downloads the course / monthly report PDFs.
//
// Auth note: the report endpoints are bearer-token protected. `window.open`
// cannot attach an Authorization header, so each PDF is fetched as a blob via
// `apiFetch` (which injects the token) and the resulting object URL is opened
// in a new tab.

const BRAND = {
  dark: "#034852",
  mid: "#209379",
  green: "#0abe62",
  yellow: "#ffde00",
};

const PAGE_SIZE = 50;

function openPdf({ blob, filename }: StudentReportPdf) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  // If the popup was blocked, fall back to a direct download.
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Revoke after a delay so the new tab has time to load the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const STATE_OPTIONS = [
  { value: "KERALA", label: "Kerala" },
  { value: "KARNATAKA", label: "Karnataka" },
  { value: "TAMIL_NADU", label: "Tamil Nadu" },
];

function buildYearOptions(): number[] {
  const now = new Date().getFullYear();
  const start = 2022;
  const out: number[] = [];
  for (let y = now; y >= start; y--) out.push(y);
  return out;
}

export function StaffReportsView() {
  const [schools, setSchools] = useState<AnalyticsSchool[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [students, setStudents] = useState<AnalyticsStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState("");
  const [year, setYear] = useState("");
  const yearOptions = buildYearOptions();
  const [bulkScope, setBulkScope] = useState<"monthly" | "course" | "full">("monthly");
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkCourses, setBulkCourses] = useState<StudentCourse[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkPercent, setBulkPercent] = useState(0);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Load the schools available to the caller. School filter is optional —
  // by default we show every student in the caller's scope.
  useEffect(() => {
    getAnalyticsSchools()
      .then((rows) => {
        setSchools(rows);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load schools."),
      );
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Load students for the selected school and filters.
  useEffect(() => {
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    }, 0);
    getAnalyticsStudentsPaged({
      role: "STUDENT",
      school_id: schoolId || undefined,
      programme_type: programme || undefined,
      status: status || undefined,
      state: state || undefined,
      year: year || undefined,
      search: debouncedSearch || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setStudents(res.rows);
        setTotal(res.total);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load students.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [schoolId, programme, status, state, year, debouncedSearch, page]);

  // The staff course catalogue is not available to every staff permission set,
  // so by-course bulk options are derived from the currently visible students.
  useEffect(() => {
    if (bulkScope !== "course") return;
    if (students.length === 0) {
      const emptyTimer = window.setTimeout(() => {
        setBulkCourses([]);
        setBulkCourseId("");
      }, 0);
      return () => window.clearTimeout(emptyTimer);
    }

    let cancelled = false;
    Promise.all(
      students.map((student) =>
        getStudentCourses(student.id).catch(() => [] as StudentCourse[]),
      ),
    ).then((courseLists) => {
      if (cancelled) return;
      const unique = new Map<string, StudentCourse>();
      courseLists.flat().forEach((course) => unique.set(course.id, course));
      setBulkCourses([...unique.values()]);
      setBulkCourseId((prev) => (prev && unique.has(prev) ? prev : ""));
    });

    return () => {
      cancelled = true;
    };
  }, [bulkScope, students]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  async function handleBulkDownload() {
    if (total === 0) {
      setBulkError("No students match the selected filters.");
      return;
    }
    setBulkBusy(true);
    setBulkError(null);
    setBulkPercent(0);
    try {
      const { jobId } = await startBulkReport({
        scope: bulkScope,
        courseId: bulkScope === "course" ? bulkCourseId : undefined,
        filters: {
          role: "STUDENT",
          school_id: schoolId || undefined,
          programme_type: programme || undefined,
          status: status || undefined,
          state: state || undefined,
          year: year || undefined,
          search: debouncedSearch || undefined,
        },
      });

      for (;;) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const next = await getBulkReportStatus(jobId);
        setBulkPercent(next.percent);
        if (next.status === "done") break;
        if (next.status === "error") {
          throw new Error(next.error ?? "Bulk job failed.");
        }
      }

      openPdf(await downloadBulkReport(jobId));
      showToast("Bulk report ZIP downloaded.");
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk download failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <p style={labelStyle}>Reports</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>
          Student Reports
        </h1>
        <p style={{ ...subtitleStyle, marginTop: "6px" }}>
          Download per-student course, monthly, and full report PDFs.
        </p>
      </div>

      {schools.length > 0 && (
        <div style={{ marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <label style={{ ...subtitleStyle, fontSize: "13px" }}>
            School
            <select
              value={schoolId}
              onChange={(e) => {
                setSchoolId(e.target.value);
                setPage(0);
              }}
              style={{ ...inputStyle, marginLeft: "10px" }}
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label style={{ ...subtitleStyle, fontSize: "13px" }}>
            State
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setPage(0);
              }}
              style={{ ...inputStyle, marginLeft: "10px" }}
            >
              <option value="">All states</option>
              {STATE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label style={{ ...subtitleStyle, fontSize: "13px" }}>
            Year
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(0);
              }}
              style={{ ...inputStyle, marginLeft: "10px" }}
            >
              <option value="">All years</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <div style={errorBanner}>{error}</div>}

      <div style={{ ...tableCard, padding: "16px 20px", marginBottom: "16px" }}>
        <p style={{ ...labelStyle, margin: "0 0 8px" }}>Bulk download</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
          <select
            value={bulkScope}
            onChange={(e) => setBulkScope(e.target.value as "monthly" | "course" | "full")}
            style={inputStyle}
          >
            <option value="monthly">Monthly</option>
            <option value="course">By course</option>
            <option value="full">Full report</option>
          </select>
          {bulkScope === "course" && (
            <select
              value={bulkCourseId}
              onChange={(e) => setBulkCourseId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select a course…</option>
              {bulkCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleBulkDownload}
            disabled={bulkBusy || total === 0 || (bulkScope === "course" && !bulkCourseId)}
            style={{
              ...inputStyle,
              background: BRAND.mid,
              color: "#fff",
              cursor: bulkBusy || total === 0 || (bulkScope === "course" && !bulkCourseId) ? "not-allowed" : "pointer",
              opacity: bulkBusy || total === 0 || (bulkScope === "course" && !bulkCourseId) ? 0.6 : 1,
            }}
          >
            {bulkBusy ? `Preparing… ${bulkPercent}%` : "Download all (ZIP)"}
          </button>
        </div>
        {bulkBusy && (
          <div style={{ marginTop: "10px", height: "6px", background: "rgba(3,72,82,0.1)", borderRadius: "3px" }}>
            <div style={{ width: `${bulkPercent}%`, height: "100%", background: BRAND.green, borderRadius: "3px", transition: "width 0.3s" }} />
          </div>
        )}
        {bulkError && <p style={{ ...subtitleStyle, color: "#c53030", margin: "8px 0 0" }}>{bulkError}</p>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: "220px" }}
        />
        <select
          value={programme}
          onChange={(e) => {
            setProgramme(e.target.value);
            setPage(0);
          }}
          style={inputStyle}
          aria-label="Batch"
          title="Batch (UG / PG)"
        >
          <option value="">All batches</option>
          <option value="UG">UG</option>
          <option value="PG">PG</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          style={inputStyle}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div style={tableCard}>
        {loading ? (
          <p style={{ ...subtitleStyle, padding: "24px", textAlign: "center" }}>
            Loading students…
          </p>
        ) : students.length === 0 ? (
          <p style={{ ...subtitleStyle, padding: "24px", textAlign: "center" }}>
            No students found.
          </p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={headerCellStyle}>Name</th>
                <th style={headerCellStyle}>Email</th>
                <th style={headerCellStyle}>Programme</th>
                <th style={{ ...headerCellStyle, textAlign: "right" }}>
                  Reports
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr
                  key={student.id}
                  style={{
                    background:
                      index % 2 === 0 ? "#ffffff" : "rgba(3,72,82,0.04)",
                  }}
                >
                  <td style={cellStyle}>{student.name}</td>
                  <td style={cellStyle}>{student.email ?? "-"}</td>
                  <td style={cellStyle}>{student.programme_type ?? "-"}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    <StudentReportsMenu
                      studentId={student.id}
                      studentName={student.name}
                      onToast={showToast}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center", justifyContent: "flex-end", marginTop: "14px" }}>
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          style={{ ...inputStyle, cursor: page <= 0 ? "not-allowed" : "pointer", opacity: page <= 0 ? 0.5 : 1 }}
        >
          ← Prev
        </button>
        <span style={{ ...subtitleStyle, fontSize: "13px" }}>
          Page {page + 1} of {pageCount} · {total} students
        </span>
        <button
          type="button"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          style={{ ...inputStyle, cursor: page + 1 >= pageCount ? "not-allowed" : "pointer", opacity: page + 1 >= pageCount ? 0.5 : 1 }}
        >
          Next →
        </button>
      </div>

      {toast && <div style={toastStyle}>{toast}</div>}
    </div>
  );
}

// ─── Per-student reports dropdown ─────────────────────────────────────────────

function StudentReportsMenu({
  studentId,
  studentName,
  onToast,
}: {
  studentId: string;
  studentName: string;
  onToast: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  // Completed-test history for the per-test report list. Deferred until the menu
  // opens (the dropdown is rendered once per student row, so eager fetching
  // would fan out across the whole page). `tests`/`testsError` keep the same
  // null = loading semantics the render below already relies on.
  const {
    data: testsData,
    isError: testsIsError,
    error: testsErrorObj,
  } = useReportHistory(studentId, open);
  const tests: PerformanceHistoryRow[] | null = testsData?.rows ?? null;
  const testsError = testsIsError
    ? testsErrorObj instanceof Error
      ? testsErrorObj.message
      : "Failed to load tests."
    : null;
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  // Close the menu on outside click. After portalling the panel, clicks inside
  // the portal are no longer descendants of `menuRef`, so we also accept clicks
  // inside `panelRef`.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && menuRef.current.contains(target)) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Compute fixed-position coordinates for the portalled panel from the
  // trigger's bounding rect. Recompute on resize and on any scroll in the
  // ancestor chain (capture phase so scrolling parents trigger it).
  useEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Lazily fetch the student's enrolled courses the first time the menu opens
  // — the analytics student row does not carry a courseId.
  useEffect(() => {
    if (!open || courses !== null) return;
    getStudentCourses(studentId)
      .then(setCourses)
      .catch((e) => {
        setCourses([]);
        setCoursesError(
          e instanceof Error ? e.message : "Failed to load courses.",
        );
      });
  }, [open, courses, studentId]);

  async function handleCourseReport(courseId: string) {
    setBusy(true);
    try {
      openPdf(await downloadStudentCourseReportPdf(studentId, courseId));
      onToast(`Course report opened for ${studentName}.`);
      setOpen(false);
    } catch (e) {
      onToast(
        e instanceof Error ? e.message : "Failed to download course report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTestReport(quizId: string, quizTitle: string) {
    setBusy(true);
    try {
      openPdf(await downloadStudentTestReportPdf(studentId, quizId));
      onToast(`Test report opened: ${quizTitle}.`);
      setOpen(false);
    } catch (e) {
      onToast(
        e instanceof Error ? e.message : "Failed to download test report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMonthlyReport() {
    setBusy(true);
    try {
      openPdf(await downloadStudentMonthlyReportPdf(studentId));
      onToast(`Monthly report opened for ${studentName}.`);
      setOpen(false);
    } catch (e) {
      onToast(
        e instanceof Error ? e.message : "Failed to download monthly report.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFullReport() {
    setBusy(true);
    try {
      onToast(`Preparing full report for ${studentName}…`);
      openPdf(await downloadStudentFullReportPdf(studentId));
      onToast(`Full report opened for ${studentName}.`);
      setOpen(false);
    } catch (e) {
      onToast(
        e instanceof Error ? e.message : "Failed to download full report.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        style={{
          ...menuTriggerStyle,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? "Preparing…" : "Reports ▾"}
      </button>

      {open && panelPos !== null && typeof document !== "undefined"
        && createPortal(
        <div
          ref={panelRef}
          style={{
            ...menuPanelStyle,
            position: "fixed",
            top: panelPos.top,
            right: panelPos.right,
            maxHeight: `calc(100vh - ${panelPos.top + 16}px)`,
            overflowY: "auto",
            zIndex: 1000,
          }}
        >
          <p style={menuSectionLabel}>Course report</p>
          {courses === null ? (
            <p style={menuHint}>Loading courses…</p>
          ) : courses.length === 0 ? (
            <p style={menuHint}>
              {coursesError ?? "No enrolled courses."}
            </p>
          ) : (
            courses.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => handleCourseReport(course.id)}
                disabled={busy}
                style={menuItemStyle}
              >
                {course.title}
              </button>
            ))
          )}

          <div style={menuDivider} />

          <p style={menuSectionLabel}>Test report</p>
          {testsError ? (
            <p style={menuHint}>{testsError}</p>
          ) : tests === null ? (
            <p style={menuHint}>Loading tests…</p>
          ) : tests.length === 0 ? (
            <p style={menuHint}>No completed tests yet.</p>
          ) : (
            tests.map((t) => (
              <button
                key={t.attempt_id}
                type="button"
                onClick={() => handleTestReport(t.quiz_id, t.quiz_title)}
                disabled={busy}
                style={menuItemStyle}
              >
                {t.quiz_title} ·{" "}
                {new Date(t.submitted_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </button>
            ))
          )}

          <div style={menuDivider} />

          <button
            type="button"
            onClick={handleMonthlyReport}
            disabled={busy}
            style={{ ...menuItemStyle, fontWeight: 600 }}
          >
            Download monthly report
          </button>
          <button
            type="button"
            onClick={handleFullReport}
            disabled={busy}
            style={{ ...menuItemStyle, fontWeight: 600 }}
          >
            Download full report
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: BRAND.mid,
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "22px",
  fontWeight: 700,
  color: BRAND.dark,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(3,72,82,0.18)",
  fontSize: "14px",
  fontFamily: "var(--font-body)",
  outline: "none",
};

const tableCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "20px",
  boxShadow: "0 16px 32px rgba(3,72,82,0.08)",
  overflow: "hidden",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableHeaderRow: React.CSSProperties = {
  background: "rgba(3,72,82,0.06)",
  textAlign: "left",
};

const headerCellStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(3,72,82,0.7)",
};

const cellStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: BRAND.dark,
  borderTop: "1px solid rgba(3,72,82,0.06)",
};

const menuTriggerStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(3,72,82,0.18)",
  background: "#ffffff",
  color: BRAND.dark,
  fontSize: "13px",
  fontWeight: 600,
};

const menuPanelStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  minWidth: "240px",
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "12px",
  boxShadow: "0 12px 28px rgba(3,72,82,0.18)",
  padding: "8px",
  zIndex: 30,
  textAlign: "left",
};

const menuSectionLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "rgba(3,72,82,0.5)",
  padding: "4px 8px",
  margin: 0,
};

const menuHint: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(3,72,82,0.5)",
  padding: "6px 8px",
  margin: 0,
};

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 8px",
  borderRadius: "8px",
  border: "none",
  background: "transparent",
  color: BRAND.dark,
  fontSize: "13px",
  cursor: "pointer",
};

const menuDivider: React.CSSProperties = {
  height: "1px",
  background: "rgba(3,72,82,0.1)",
  margin: "6px 4px",
};

const errorBanner: React.CSSProperties = {
  marginBottom: "16px",
  padding: "10px 12px",
  borderRadius: "10px",
  background: "rgba(229,62,62,0.08)",
  border: "1px solid rgba(229,62,62,0.2)",
  color: "#c53030",
  fontSize: "13px",
  fontWeight: 600,
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  right: "24px",
  bottom: "24px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: BRAND.green,
  color: "#ffffff",
  fontWeight: 600,
  boxShadow: "0 12px 24px rgba(10,190,98,0.25)",
  zIndex: 50,
};
