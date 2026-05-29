"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  getAssignmentById,
  getSubmissions,
  type Assignment,
  type Submission,
} from "@/lib/api";
import { GradePanel, StatusBadge } from "@/app/dashboard/assignments/_components/GradePanel";

// ── Page ───────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const userId   = userData?.user?.id ?? "";

  const [assignment,   setAssignment]   = useState<Assignment | null>(null);
  const [submissions,  setSubmissions]  = useState<Submission[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeSubId,  setActiveSubId]  = useState<string | null>(null);

  const canGrade = has(PERM.assignments.grade);

  const reload = useCallback(async () => {
    try {
      const [a, subs] = await Promise.all([
        getAssignmentById(assignmentId),
        getSubmissions(assignmentId),
      ]);
      setAssignment(a);
      setSubmissions(subs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    }
  }, [assignmentId]);

  useEffect(() => {
    if (userLoading || !userId) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [userLoading, userId, reload]);

  if (loading || userLoading || permLoading) return <LoadingState />;

  if (!canGrade) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Access Denied</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>You don&apos;t have permission to view or grade submissions.</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div style={glassCard}>
        <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error ?? "Not found."}</p>
        <Link href="/dashboard/assignments" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
          ← Back
        </Link>
      </div>
    );
  }

  const activeSub = submissions.find(s => s.id === activeSubId) ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: activeSubId ? "1fr 420px" : "1fr", gap: "24px", alignItems: "flex-start" }}>

      {/* ── Left: Assignment + table ────────────────── */}
      <div>
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <Link href="/dashboard/assignments" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
            ← Assignments
          </Link>
          <div style={{ marginTop: "10px" }}>
            <p style={S.label}>Grading</p>
            <h1 style={{ ...S.heading, fontSize: "24px", margin: "4px 0 4px" }}>{assignment.title}</h1>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", margin: 0 }}>
              Due: {new Date(assignment.due_at).toLocaleDateString()} · {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Submissions table */}
        {submissions.length === 0 ? (
          <div style={{ ...glassCard, textAlign: "center", padding: "40px" }}>
            <p style={S.label}>No Submissions Yet</p>
            <p style={{ ...S.heading, fontSize: "16px", marginTop: "12px" }}>Students haven&apos;t submitted yet.</p>
          </div>
        ) : (
          <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
                  {["Student", "Roll No.", "Submitted", "Status", "Score", ""].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => {
                  const isActive = sub.id === activeSubId;
                  return (
                    <tr
                      key={sub.id}
                      style={{
                        borderBottom: "1px solid rgba(3,72,82,0.05)",
                        background: isActive ? "rgba(10,190,98,0.04)" : "transparent",
                        cursor: "pointer",
                        transition: "background 150ms ease",
                      }}
                      onClick={() => setActiveSubId(isActive ? null : sub.id)}
                    >
                      <td style={tdStyle}><strong style={{ color: "#034852" }}>{sub.student_name ?? "—"}</strong></td>
                      <td style={tdStyle}>{sub.student_roll ?? "—"}</td>
                      <td style={tdStyle}>
                        {sub.submitted_at ? (
                          <span>
                            {new Date(sub.submitted_at).toLocaleDateString()}{" "}
                            <span style={{ color: "rgba(3,72,82,0.45)" }}>{new Date(sub.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </span>
                        ) : "—"}
                        {sub.is_late && (
                          <span style={{ marginLeft: "6px", padding: "1px 6px", borderRadius: "6px", fontSize: "9px", fontWeight: 700, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>LATE</span>
                        )}
                      </td>
                      <td style={tdStyle}><StatusBadge status={sub.status} /></td>
                      <td style={tdStyle}>
                        {sub.score != null ? (
                          <strong style={{ color: "#034852" }}>{sub.score}</strong>
                        ) : (
                          <span style={{ color: "rgba(3,72,82,0.3)" }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: "11px", color: "#209379", fontWeight: 700 }}>
                          {isActive ? "▲ Close" : "▼ Grade"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Right: Grade panel ──────────────────────── */}
      {activeSub && (
        <GradePanel
          key={activeSub.id}
          submission={activeSub}
          assignmentId={assignmentId}
          graderId={userId}
          onSaved={async () => {
            await reload();
          }}
          onClose={() => setActiveSubId(null)}
        />
      )}
    </div>
  );
}


function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching submissions…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "24px 28px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};
const S = {
  label:      { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading:    { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  input:      { width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", transition: "all 200ms ease" } as React.CSSProperties,
};
const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379", background: "rgba(32,147,121,0.04)" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px" };
