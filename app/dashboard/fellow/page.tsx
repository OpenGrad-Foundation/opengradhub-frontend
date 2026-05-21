"use client";

import { useEffect, useRef, useState } from "react";
import {
  getAnalyticsSchools,
  getAnalyticsStudents,
  getStudentCourses,
  downloadStudentCourseReportPdf,
  downloadStudentMonthlyReportPdf,
  type AnalyticsSchool,
  type AnalyticsStudent,
  type StudentCourse,
  type StudentReportPdf,
} from "@/lib/api";

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

export default function FellowDashboardPage() {
  const [schools, setSchools] = useState<AnalyticsSchool[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [students, setStudents] = useState<AnalyticsStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load the fellow's schools and default to the first one.
  useEffect(() => {
    getAnalyticsSchools()
      .then((rows) => {
        setSchools(rows);
        setSchoolId((prev) => prev || rows[0]?.id || "");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load schools."),
      );
  }, []);

  // Load students for the selected school.
  useEffect(() => {
    setLoading(true);
    setError(null);
    getAnalyticsStudents({
      role: "STUDENT",
      school_id: schoolId || undefined,
    })
      .then(setStudents)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load students."),
      )
      .finally(() => setLoading(false));
  }, [schoolId]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <p style={labelStyle}>Fellow</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>
          My Students
        </h1>
        <p style={{ ...subtitleStyle, marginTop: "6px" }}>
          Download per-student course and monthly report PDFs.
        </p>
      </div>

      {schools.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <label style={{ ...subtitleStyle, fontSize: "13px" }}>
            School
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              style={{ ...inputStyle, marginLeft: "10px" }}
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <div style={errorBanner}>{error}</div>}

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
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu on outside click.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      <button
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

      {open && (
        <div style={menuPanelStyle}>
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

          <button
            type="button"
            onClick={handleMonthlyReport}
            disabled={busy}
            style={{ ...menuItemStyle, fontWeight: 600 }}
          >
            Download monthly report
          </button>
        </div>
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
