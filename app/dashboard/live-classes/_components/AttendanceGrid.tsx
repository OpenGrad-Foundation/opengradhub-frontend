"use client";

import { useEffect, useState } from "react";
import { getCourses, type Course } from "@/lib/api";
import { useBatches } from "@/lib/queries/batches";
import { useAttendanceSummary, useStudentAttendance } from "@/lib/queries/live-classes";

export function AttendanceGrid() {
  const [mode, setMode] = useState<"course" | "batch">("course");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [drillStudent, setDrillStudent] = useState<string | null>(null);

  const params = {
    ...(mode === "course" ? { course_id: entityId } : { batch_id: entityId }),
    ...(from ? { from: new Date(from).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59`).toISOString() } : {}),
    page,
    limit: 25,
  };
  const { data, isPending, error } = useAttendanceSummary(entityId ? params : {});

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px", alignItems: "center" }}>
        <select value={mode} onChange={(e) => { setMode(e.target.value as "course" | "batch"); setEntityId(""); setPage(1); }} style={S.select}>
          <option value="course">By course</option>
          <option value="batch">By batch</option>
        </select>
        <EntitySelect mode={mode} value={entityId} onChange={(v) => { setEntityId(v); setPage(1); }} />
        <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={S.select} />
        <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>to</span>
        <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={S.select} />
      </div>

      {!entityId ? (
        <div style={{ ...S.card, textAlign: "center", padding: "40px" }}>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", margin: 0 }}>
            Pick a {mode} to see student-wise attendance.
          </p>
        </div>
      ) : isPending ? (
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>Loading grid…</p>
      ) : error ? (
        <p style={{ color: "#e53e3e", fontSize: "14px" }}>{(error as Error).message}</p>
      ) : !data || data.classes.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: "40px" }}>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", margin: 0 }}>No past classes in this range.</p>
        </div>
      ) : (
        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(3,72,82,0.1)" }}>
                  <th style={{ ...S.th, textAlign: "left", position: "sticky", left: 0, background: "#fff" }}>Student</th>
                  {data.classes.map((c) => (
                    <th key={c.id} style={S.th} title={c.title}>
                      {new Date(c.scheduled_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </th>
                  ))}
                  <th style={S.th}>%</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((st) => (
                  <tr key={st.id} onClick={() => setDrillStudent(st.id)}
                    style={{ borderBottom: "1px solid rgba(3,72,82,0.06)", cursor: "pointer" }}>
                    <td style={{ ...S.td, textAlign: "left", position: "sticky", left: 0, background: "#fff", fontWeight: 600, color: "#034852" }}>
                      {st.name}
                      {st.school_name && <span style={{ display: "block", fontSize: "11px", color: "rgba(3,72,82,0.5)", fontWeight: 400 }}>{st.school_name}</span>}
                    </td>
                    {st.cells.map((cell, i) => (
                      <td key={data.classes[i].id} style={{ ...S.td, color: cell === "PRESENT" ? "#0abe62" : "rgba(229,62,62,0.7)", fontWeight: 700 }}>
                        {cell === "PRESENT" ? "✓" : "✗"}
                      </td>
                    ))}
                    <td style={{ ...S.td, fontWeight: 700, color: "#034852" }}>{st.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.total > data.limit && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", alignItems: "center" }}>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={S.pageBtn}>← Prev</button>
              <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)" }}>
                Page {data.page} · {data.total} students
              </span>
              <button disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)} style={S.pageBtn}>Next →</button>
            </div>
          )}
        </div>
      )}

      {drillStudent && <StudentDrilldown studentId={drillStudent} onClose={() => setDrillStudent(null)} />}
    </div>
  );
}

function EntitySelect({ mode, value, onChange }: { mode: "course" | "batch"; value: string; onChange: (v: string) => void }) {
  // Same data sources as the schedule-class form: getCourses(all statuses) + useBatches().
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => {
    let cancelled = false;
    getCourses(undefined, undefined, undefined, true)
      .then((cs) => { if (!cancelled) setCourses(cs); })
      .catch(() => { /* dropdown stays empty; summary errors surface separately */ });
    return () => { cancelled = true; };
  }, []);
  const batches = useBatches();

  const options = mode === "course"
    ? courses.map((c) => ({ id: c.id, label: c.title }))
    : (batches.data ?? []).map((b) => ({ id: b.id, label: b.name }));

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...S.select, minWidth: "220px" }}>
      <option value="">Select {mode}…</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
}

function StudentDrilldown({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { data, isPending, error } = useStudentAttendance(studentId);
  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {isPending ? (
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>Loading…</p>
        ) : error ? (
          <p style={{ color: "#e53e3e", fontSize: "14px" }}>{(error as Error).message}</p>
        ) : data ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
              <div>
                <p style={S.labelSm}>Attendance history</p>
                <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", fontSize: "18px", margin: "4px 0 0" }}>{data.student.name}</h2>
                <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "4px 0 0" }}>
                  {data.student.school_name ? `${data.student.school_name} · ` : ""}
                  {data.summary.present}/{data.summary.total} attended ({data.summary.pct}%)
                </p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "rgba(3,72,82,0.5)" }}>✕</button>
            </div>
            <div style={{ maxHeight: "55vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {data.classes.length === 0 && (
                <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>No past classes for this student yet.</p>
              )}
              {data.classes.map((c) => (
                <div key={c.class_id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "12px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852" }}>{c.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
                      {new Date(c.scheduled_at).toLocaleDateString("en-IN")}
                      {c.source === "MANUAL" && c.marked_by_name ? ` · marked by ${c.marked_by_name}` : ""}
                      {c.source === "AUTO" ? " · joined via link" : ""}
                    </p>
                  </div>
                  <span style={{ flexShrink: 0, padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, ...(c.status === "PRESENT" ? { background: "rgba(10,190,98,0.12)", color: "#0abe62" } : { background: "rgba(229,62,62,0.1)", color: "#e53e3e" }) }}>
                    {c.status === "PRESENT" ? "Present" : "Absent"}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

const S = {
  card: { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" } as React.CSSProperties,
  select: { padding: "8px 12px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.15)", fontSize: "13px", color: "#034852", background: "#fff", fontFamily: "var(--font-body)" } as React.CSSProperties,
  th: { padding: "10px 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#209379", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  td: { padding: "10px 12px", textAlign: "center" as const, whiteSpace: "nowrap" as const },
  pageBtn: { padding: "6px 14px", borderRadius: "8px", border: "1.5px solid rgba(3,72,82,0.15)", background: "transparent", fontSize: "12px", fontWeight: 600, color: "#034852", cursor: "pointer" } as React.CSSProperties,
  backdrop: { position: "fixed", inset: 0, background: "rgba(3,72,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" } as React.CSSProperties,
  modal: { background: "#fff", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "560px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" } as React.CSSProperties,
  labelSm: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.28em", color: "#209379", margin: 0 },
};
