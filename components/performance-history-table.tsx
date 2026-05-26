"use client";

import type { PerformanceHistoryRow } from "@/lib/api";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSubjects(subjects: PerformanceHistoryRow["subjects"]): string {
  if (!subjects || subjects.length === 0) return "—";
  return subjects
    .map((s) => `${s.subject} ${s.score}/${s.max} (rk ${s.rank})`)
    .join(" · ");
}

export function PerformanceHistoryTable({ rows }: { rows: PerformanceHistoryRow[] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: "16px" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Test</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Pattern</th>
            <th style={thStyle}>Subjects</th>
            <th style={thStyle}>Total</th>
            <th style={thStyle}>%</th>
            <th style={thStyle}>Test Rank</th>
            <th style={thStyle}>School Rank</th>
            <th style={thStyle}>Programme Rank</th>
            <th style={thStyle}>Percentile</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.attempt_id} style={trStyle}>
              <td style={{ ...tdStyle, fontWeight: 600, color: "#034852" }}>{row.quiz_title}</td>
              <td style={tdStyle}>{formatDate(row.submitted_at)}</td>
              <td style={tdStyle}>{row.quiz_type}</td>
              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatSubjects(row.subjects)}</td>
              <td style={tdStyle}>{`${row.total.marks}/${row.total.max}`}</td>
              <td style={tdStyle}>{row.total.percent}</td>
              <td style={tdStyle}>{row.ranks.test}</td>
              <td style={tdStyle}>{row.ranks.school ?? "—"}</td>
              <td style={tdStyle}>{row.ranks.programme ?? "—"}</td>
              <td style={tdStyle}>{row.percentile}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "960px",
  borderCollapse: "collapse",
  fontSize: "13px",
  fontFamily: "var(--font-body)",
  color: "#034852",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(3,72,82,0.6)",
  borderBottom: "1.5px solid rgba(3,72,82,0.15)",
  whiteSpace: "nowrap",
  background: "rgba(3,72,82,0.03)",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(3,72,82,0.08)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "top",
};
