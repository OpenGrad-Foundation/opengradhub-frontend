"use client";

import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { RoleCode } from "@/lib/moduleAccess";
import {
  downloadAnalyticsStudentsCsv,
  getAnalyticsSchools,
  getAnalyticsStudents,
  type AnalyticsSchool,
  type AnalyticsStudent,
} from "@/lib/api";

const ALLOWED_ROLES: RoleCode[] = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "FELLOW",
];

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
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId = data?.user?.id ?? "";

  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);
  const [schools, setSchools] = useState<AnalyticsSchool[]>([]);
  const [students, setStudents] = useState<AnalyticsStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const isAllowed = ALLOWED_ROLES.includes(roleCode);
  const isAdmin = roleCode === "SUPER_ADMIN" || roleCode === "PROGRAM_MANAGER";
  const isZonalManager = roleCode === "ZONAL_MANAGER";
  const isFellow = roleCode === "FELLOW";

  const filtersForApi = useMemo(() => {
    const source = activeFilters ?? filters;
    return {
      caller_role: roleCode,
      caller_id: userId,
      role: source.role || undefined,
      programme_type: source.programme_type || undefined,
      status: source.status || undefined,
      school_id: source.school_id || undefined,
      zone: source.zone.trim() || undefined,
      from: source.from || undefined,
      to: source.to || undefined,
    };
  }, [activeFilters, filters, roleCode, userId]);

  useEffect(() => {
    if (!isAllowed || !userId || !roleCode) return;

    setSchoolsLoading(true);
    getAnalyticsSchools(roleCode, userId)
      .then((data) => setSchools(data))
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load schools.");
      })
      .finally(() => setSchoolsLoading(false));
  }, [isAllowed, roleCode, userId]);

  useEffect(() => {
    if (userLoading || !isAllowed || hasInitialized) return;

    const next = { ...EMPTY_FILTERS };
    if (isZonalManager) {
      next.zone = data?.user?.zone ?? "";
    }
    setFilters(next);
    setActiveFilters(next);
    setHasInitialized(true);
  }, [userLoading, isAllowed, isZonalManager, data?.user?.zone, hasInitialized]);

  useEffect(() => {
    if (!isFellow || schools.length === 0) return;
    if (filters.school_id) return;

    const nextSchoolId = schools[0]?.id ?? "";
    const nextFilters = { ...filters, school_id: nextSchoolId };
    setFilters(nextFilters);
    if (!activeFilters) setActiveFilters(nextFilters);
  }, [isFellow, schools, filters, activeFilters]);

  useEffect(() => {
    if (!activeFilters || !roleCode || !userId) return;

    setStudentsLoading(true);
    setErrorMsg(null);
    getAnalyticsStudents(filtersForApi)
      .then((rows) => setStudents(rows))
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load students.");
      })
      .finally(() => setStudentsLoading(false));
  }, [activeFilters, filtersForApi, roleCode, userId]);

  if (userLoading) return <LoadingState />;

  if (!isAllowed) {
    return (
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={glassCard}>
          <p style={labelStyle}>Access Denied</p>
          <p style={{ ...titleStyle, marginTop: "8px" }}>
            You do not have access to this module.
          </p>
        </div>
      </div>
    );
  }

  async function handleDownload() {
    if (!roleCode || !userId) return;
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

  const tableRows = students.map((student, index) => (
    <tr
      key={student.id}
      style={{
        background: index % 2 === 0 ? "#ffffff" : "rgba(3,72,82,0.04)",
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
      <div style={{ marginBottom: "32px" }}>
        <p style={labelStyle}>Data</p>
        <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 0" }}>
          Student Export
        </h1>
        <p style={{ ...subtitleStyle, marginTop: "6px" }}>
          Filter students, preview, and download CSV exports.
        </p>
      </div>

      <div style={filterCard}>
        <div style={filterGrid}>
          {isAdmin && (
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
              <option value="UG">UG</option>
              <option value="PG">PG</option>
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
              style={{
                ...inputStyle,
                background: isFellow ? "rgba(3,72,82,0.04)" : "#ffffff",
              }}
              disabled={isFellow}
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

          {(isAdmin || isZonalManager) && (
            <FilterField label="Zone">
              <input
                type="text"
                value={filters.zone}
                onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                style={{
                  ...inputStyle,
                  background: isZonalManager ? "rgba(3,72,82,0.04)" : "#ffffff",
                }}
                disabled={isZonalManager}
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
            Apply Filters
          </button>
        </div>
      </div>

      <div style={tableCard}>
        <div style={tableHeader}>
          <div>
            <p style={labelStyle}>Preview</p>
            <p style={{ ...subtitleStyle, marginTop: "6px" }}>
              {studentsLoading
                ? "Loading students..."
                : `Showing ${students.length} students`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            style={{
              ...downloadButton,
              opacity: downloading ? 0.7 : 1,
              cursor: downloading ? "not-allowed" : "pointer",
            }}
          >
            {downloading ? "Preparing..." : "Download CSV"}
          </button>
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
        <p style={labelStyle}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
          Student Export
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
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "24px",
  padding: "36px",
  boxShadow: "0 16px 40px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.28em",
  color: "#209379",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "22px",
  fontWeight: 700,
  color: "#034852",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const filterCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 16px 32px rgba(3,72,82,0.08)",
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
  gap: "8px",
  fontSize: "13px",
  color: "#034852",
};

const fieldLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(3,72,82,0.7)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid rgba(3,72,82,0.18)",
  fontSize: "14px",
  fontFamily: "var(--font-body)",
  outline: "none",
};

const helperText: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(3,72,82,0.5)",
  marginTop: "6px",
};

const filterActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "20px",
};

const applyButton: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  background: "#034852",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "14px",
  cursor: "pointer",
};

const tableCard: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.08)",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 16px 32px rgba(3,72,82,0.08)",
};

const tableHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "16px",
  gap: "16px",
  flexWrap: "wrap",
};

const downloadButton: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "14px",
  boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
};

const tableWrapper: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: "12px",
  border: "1px solid rgba(3,72,82,0.08)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "860px",
};

const tableHeaderRow: React.CSSProperties = {
  background: "rgba(3,72,82,0.06)",
  textAlign: "left",
};

const headerCellStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(3,72,82,0.7)",
};

const cellStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "13px",
  color: "#034852",
  borderTop: "1px solid rgba(3,72,82,0.06)",
};

const errorBanner: React.CSSProperties = {
  marginBottom: "12px",
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
  background: "#0abe62",
  color: "#ffffff",
  fontWeight: 600,
  boxShadow: "0 12px 24px rgba(10,190,98,0.25)",
  zIndex: 50,
};
