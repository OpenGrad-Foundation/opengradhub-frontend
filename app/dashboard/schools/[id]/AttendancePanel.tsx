"use client";

/**
 * Read-only committed register attendance for one school, on the school detail
 * page — the answer to "can I see this school's attendance without leaving the
 * school tab?".
 *
 * Read-only on purpose: uploading a register is a review-and-commit flow that
 * belongs in the Attendance tab, and a second entry point to it here would be
 * two ways to do the same thing rather than one place that works.
 *
 * Styling follows this page's inline-style convention (schools/styles.ts), not
 * the Tailwind used in the attendance tab.
 */
import type React from "react";
import { useState } from "react";
import { useSchoolRegister } from "@/lib/queries/attendance";
import { titleStyle, thStyle, tdStyle } from "../styles";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AttendancePanel({ schoolId, canView }: { schoolId: string; canView: boolean }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string | null>(null);
  // Don't fetch until opened: most visits to this page aren't about attendance,
  // and a role without attendance.view would only earn a 403 for the trouble.
  const { data, isLoading, isError } = useSchoolRegister(schoolId, month, canView && open);

  if (!canView) return null;

  const months = data?.available_months ?? [];
  const shown = data?.month ?? null;

  return (
    <div style={{ marginBottom: "24px" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        style={sectionHeaderStyle}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span aria-hidden="true" style={{ fontSize: "12px", color: "#209379" }}>
            {open ? "▾" : "▸"}
          </span>
          <h3 style={{ ...titleStyle, fontSize: "16px", margin: 0 }}>Attendance</h3>
          <span style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>
            Committed register days
          </span>
        </div>
        {open && months.length > 0 && (
          <select
            value={shown ?? ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setMonth(e.target.value)}
            style={selectStyle}
          >
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        )}
      </div>

      {open && (
        <div style={{ marginTop: "8px" }}>
          {isLoading ? (
            <p style={emptyStyle}>Loading…</p>
          ) : isError ? (
            <p style={emptyStyle}>Could not load attendance for this school.</p>
          ) : !data || data.students.length === 0 ? (
            <p style={emptyStyle}>No register attendance has been committed for this school yet.</p>
          ) : (
            <div style={tableWrapStyle}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
                    <th style={thStyle}>Student</th>
                    <th style={{ ...thStyle, whiteSpace: "nowrap" }}>Present</th>
                    {data.dates.map((d) => (
                      <th key={d} style={{ ...thStyle, padding: "14px 8px", textAlign: "center" }}>
                        {d.slice(8)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.student_id} style={{ borderBottom: "1px solid rgba(3,72,82,0.06)" }}>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{s.name}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "rgba(3,72,82,0.7)" }}>
                        {s.present}/{s.total}
                        {s.total > 0 && ` (${Math.round((s.present / s.total) * 100)}%)`}
                      </td>
                      {data.dates.map((d) => {
                        const mark = s.marks[d];
                        return (
                          <td key={d} style={{ ...tdStyle, padding: "12px 8px", textAlign: "center" }}>
                            {mark === undefined ? (
                              <span style={{ color: "rgba(3,72,82,0.25)" }}>·</span>
                            ) : (
                              <span style={mark ? presentStyle : absentStyle}>{mark ? "P" : "A"}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const sectionHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", padding: "14px 18px", borderRadius: "14px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff", cursor: "pointer", userSelect: "none" };
const selectStyle: React.CSSProperties = { padding: "6px 10px", borderRadius: "10px", border: "1px solid rgba(3,72,82,0.2)", background: "#fff", color: "#034852", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const tableWrapStyle: React.CSSProperties = { background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "14px", overflowX: "auto" };
const emptyStyle: React.CSSProperties = { padding: "16px 18px", background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "14px", color: "rgba(3,72,82,0.6)", fontSize: "13px" };
const presentStyle: React.CSSProperties = { display: "inline-block", minWidth: "22px", padding: "2px 6px", borderRadius: "8px", background: "rgba(10,190,98,0.12)", color: "#0a7c45", fontWeight: 700, fontSize: "12px" };
const absentStyle: React.CSSProperties = { display: "inline-block", minWidth: "22px", padding: "2px 6px", borderRadius: "8px", background: "rgba(197,48,48,0.1)", color: "#c53030", fontWeight: 700, fontSize: "12px" };
