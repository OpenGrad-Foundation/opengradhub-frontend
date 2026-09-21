"use client";

import { ArrowLeft, Inbox } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { BackLink } from "@/components/back-link";
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
        <p style={{ color: "#b83232", fontWeight: 600 }}>{error ?? "Not found."}</p>
        <BackLink fallback="/dashboard/assignments" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
          ← Back
        </BackLink>
      </div>
    );
  }

  const activeSub = submissions.find(s => s.id === activeSubId) ?? null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>

      {/* ── Left: Assignment + table ────────────────── */}
      <div style={{ flex: "1 1 400px", minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <BackLink fallback="/dashboard/assignments" style={{ ...S.primaryBtn, background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}>
            <ArrowLeft size={16} aria-hidden="true" />Assignments
          </BackLink>
          <div style={{ marginTop: "20px" }}>
            <h2 style={{ ...S.heading, fontSize: "28px", lineHeight: 1.3, margin: "0 0 12px" }}>{assignment.title}</h2>
            <p style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
              <span>Due {new Date(assignment.due_at).toLocaleDateString()}</span>
              <span>{submissions.length} submission{submissions.length !== 1 ? "s" : ""}</span>
            </p>
          </div>
        </div>

        {/* Submissions table */}
        {submissions.length === 0 ? (
          <div style={{ ...glassCard, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center", padding: "48px 24px" }}>
            <Inbox size={24} aria-hidden="true" style={{ color: "var(--teal)" }} />
            <h3 style={{ ...S.heading, fontSize: "18px", fontWeight: 600, margin: 0 }}>No submissions yet</h3>
            <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>Submissions appear here as students turn them in.</p>
          </div>
        ) : (
          <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px", minWidth: "500px" }}>
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
                      <td style={tdStyle}><strong style={{ color: "var(--color-text)" }}>{sub.student_name ?? "—"}</strong></td>
                      <td style={tdStyle}>{sub.student_roll ?? "—"}</td>
                      <td style={tdStyle}>
                        {sub.submitted_at ? (
                          <span>
                            {new Date(sub.submitted_at).toLocaleDateString()}{" "}
                            <span style={{ color: "var(--color-text-muted)" }}>{new Date(sub.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </span>
                        ) : "—"}
                        {sub.is_late && (
                          <span style={{ marginLeft: "6px", padding: "1px 6px", borderRadius: "6px", fontSize: "9px", fontWeight: 700, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>LATE</span>
                        )}
                      </td>
                      <td style={tdStyle}><StatusBadge status={sub.status} /></td>
                      <td style={tdStyle}>
                        {sub.score != null ? (
                          <strong style={{ color: "var(--color-text)" }}>{sub.score}</strong>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
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
          </div>
        )}
      </div>

      {/* ── Right: Grade panel ──────────────────────── */}
      {activeSub && (
        <div style={{ flex: "1 1 420px", maxWidth: "100%" }}>
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
        </div>
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
  background: "var(--color-surface)", border: "1px solid var(--color-border)",
  borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)",
};
const S = {
  label:      { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 } as React.CSSProperties,
  heading:    { fontWeight: 700, color: "var(--color-text)" } as React.CSSProperties,
  input:      { width: "100%", minHeight: "44px", padding: "8px 12px", background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", borderRadius: "8px", color: "var(--color-text)", fontSize: "14px", boxSizing: "border-box" } as React.CSSProperties,
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
};
const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)", background: "#eef5f3" };
const tdStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", color: "var(--color-text)", fontSize: "13px", borderTop: "1px solid var(--color-border)" };
