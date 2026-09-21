"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  downloadAnalyticsStudentsCsv,
  getAnalyticsSchools,
  getAnalyticsStudents,
  type AnalyticsSchool,
  type AnalyticsStudent,
} from "@/lib/api";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";
import { Download } from "lucide-react";

// Record filters narrow the backend-authorized roster.

const ROLE_OPTIONS = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "FELLOW",
  "STUDENT",
  "GOVERNMENT",
  "FUNDING_PARTNER",
] as const;

type FilterState = {
  role: string;
  programme_type: string;
  status: string;
  school_id: string;
  zone: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: FilterState = {
  role: "",
  programme_type: "",
  status: "",
  school_id: "",
  zone: "",
  from: "",
  to: "",
};

export default function StudentExportPage() {
  const { has, isLoading } = usePermissions();
  if (isLoading) return <LoadingState />;
  if (!has(PERM.student_export.view) || !has(PERM.students.view)) return <p>You do not have permission to view this roster.</p>;
  return <StudentExportContent />;
}

function StudentExportContent() {
  const canDownload = usePermissions().has(PERM.student_export.run);

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [activeFilters, setActiveFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [schools, setSchools] = useState<AnalyticsSchool[]>([]);
  const [students, setStudents] = useState<AnalyticsStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const filtersForApi = useMemo(() => {
    const source = activeFilters ?? filters;
    return {
      role: source.role || undefined,
      programme_type: source.programme_type || undefined,
      status: source.status || undefined,
      school_id: source.school_id || undefined,
      zone: source.zone.trim() || undefined,
      from: source.from || undefined,
      to: source.to || undefined,
    };
  }, [activeFilters, filters]);

  useEffect(() => {
    setSchoolsLoading(true);
    getAnalyticsSchools()
      .then((data) => setSchools(data))
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load schools.");
      })
      .finally(() => setSchoolsLoading(false));
  }, []);

  useEffect(() => {
    if (!activeFilters) return;

    setStudentsLoading(true);
    setErrorMsg(null);
    getAnalyticsStudents(filtersForApi)
      .then((rows) => setStudents(rows))
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load students.");
      })
      .finally(() => setStudentsLoading(false));
  }, [activeFilters, filtersForApi]);

  async function handleDownload() {
    if (!canDownload) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const { blob, filename } = await downloadAnalyticsStudentsCsv(filtersForApi);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setToastMessage("CSV download started.");
      window.setTimeout(() => setToastMessage(null), 2400);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Download failed. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  }

  function handleApplyFilters() {
    setActiveFilters({ ...filters });
  }

  const tableRows = students.map((student) => (
    <tr
      key={student.id}
      style={{
        background: "var(--color-surface)",
      }}
    >
      <td style={cellStyle}>{student.name}</td>
      <td style={cellStyle}>{student.email ?? "-"}</td>
      <td style={cellStyle}>{student.role}</td>
      <td style={cellStyle}>{student.programme_type ?? "-"}</td>
      <td style={cellStyle}>{student.school_name ?? "-"}</td>
      <td style={cellStyle}>{student.zone ?? "-"}</td>
      <td style={cellStyle}>{student.status}</td>
      <td style={cellStyle}>{formatDate(student.created_at)}</td>
    </tr>
  ));

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={filterCard}>
        <div style={filterGrid}>
          {(
            <FilterField label="Role">
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                style={inputStyle}
              >
                <option value="">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </FilterField>
          )}

          <FilterField label="Programme Type">
            <select
              value={filters.programme_type}
              onChange={(e) => setFilters({ ...filters, programme_type: e.target.value })}
              style={inputStyle}
            >
              <option value="">All</option>
              {PROGRAMME_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={inputStyle}
            >
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </FilterField>

          <FilterField label="School">
            <select
              value={filters.school_id}
              onChange={(e) => setFilters({ ...filters, school_id: e.target.value })}
              style={inputStyle}
            >
              <option value="">All schools</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
            {schoolsLoading && (
              <div style={helperText}>Loading schools...</div>
            )}
          </FilterField>

          {(
            <FilterField label="Zone">
              <input
                type="text"
                value={filters.zone}
                onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                style={inputStyle}
                placeholder="e.g. TN-CHN"
              />
            </FilterField>
          )}

          <FilterField label="From">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              style={inputStyle}
            />
          </FilterField>

          <FilterField label="To">
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              style={inputStyle}
            />
          </FilterField>
        </div>

        <div style={filterActions}>
          <button
            type="button"
            onClick={handleApplyFilters}
            style={applyButton}
          >
            Apply filters
          </button>
        </div>
      </div>

      <div style={tableCard}>
        <div style={tableHeader}>
          <div>
            <p style={sectionTitle}>Preview</p>
            <p style={{ ...subtitleStyle, marginTop: "6px" }}>
              {studentsLoading
                ? "Loading students..."
                : `Showing ${students.length} students`}
            </p>
          </div>
          {canDownload && <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            style={{
              ...downloadButton,
              opacity: downloading ? 0.7 : 1,
              cursor: downloading ? "not-allowed" : "pointer",
            }}
          >
            <Download size={16} aria-hidden="true" />
            {downloading ? "Preparing..." : "Download CSV"}
          </button>}
        </div>

        {downloadError && (
          <div style={errorBanner}>
            <span>{downloadError}</span>
          </div>
        )}

        {errorMsg && (
          <div style={errorBanner}>
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={tableWrapper}>
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRow}>
                <th style={headerCellStyle}>Name</th>
                <th style={headerCellStyle}>Email</th>
                <th style={headerCellStyle}>Role</th>
                <th style={headerCellStyle}>Programme</th>
                <th style={headerCellStyle}>School</th>
                <th style={headerCellStyle}>Zone</th>
                <th style={headerCellStyle}>Status</th>
                <th style={headerCellStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && !studentsLoading ? (
                <tr>
                  <td style={{ ...cellStyle, padding: "24px" }} colSpan={8}>
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                tableRows
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toastMessage && (
        <div style={toastStyle}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={fieldStyle}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)" }}>
          Loading student export
        </p>
        <p style={{ ...subtitleStyle, marginTop: "8px" }}>Please wait...</p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

const glassCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "var(--color-text)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--color-text-muted)",
};

const filterCard: React.CSSProperties = {
  ...glassCard,
  marginBottom: "24px",
};

const filterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "14px",
  color: "var(--color-text)",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
};

const inputStyle: React.CSSProperties = {
  minHeight: "44px",
  padding: "0 12px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: "14px",
};

const helperText: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-text-muted)",
  marginTop: "6px",
};

const filterActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "20px",
};

const applyButton: React.CSSProperties = {
  minHeight: "44px",
  padding: "0 18px",
  borderRadius: "12px",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
};

const tableCard: React.CSSProperties = glassCard;

const tableHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
  gap: "16px",
  flexWrap: "wrap",
};

const downloadButton: React.CSSProperties = {
  minHeight: "44px",
  padding: "0 18px",
  borderRadius: "12px",
  border: "1px solid var(--green)",
  background: "var(--green)",
  color: "var(--dark-teal)",
  fontWeight: 600,
  fontSize: "14px",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const tableWrapper: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: "8px",
  border: "1px solid var(--color-border)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "860px",
};

const tableHeaderRow: React.CSSProperties = {
  background: "#eef5f3",
  textAlign: "left",
};

const headerCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--color-text-muted)",
};

const cellStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "13px",
  color: "var(--color-text)",
  borderTop: "1px solid var(--color-border)",
};

const errorBanner: React.CSSProperties = {
  marginBottom: "12px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "rgba(184,50,50,0.06)",
  border: "1px solid rgba(184,50,50,0.25)",
  color: "#b83232",
  fontSize: "13px",
  fontWeight: 600,
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  right: "24px",
  bottom: "24px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "var(--green)",
  color: "var(--dark-teal)",
  fontWeight: 600,
  zIndex: 50,
};
