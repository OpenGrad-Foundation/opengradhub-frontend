"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { getAssignments, type Assignment } from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

export default function AssignmentsPage() {
  const { data, isLoading } = useCurrentUser();
  const { has } = usePermissions();
  const roleCode = (data?.role?.code ?? "") as RoleCode;
  const userId   = data?.user?.id ?? "";

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // "Manager view" = can grade submissions. Creating is a separate permission.
  const canGrade  = has(PERM.assignments.grade);
  const canCreate = has(PERM.assignments.create);
  const isManager = canGrade;

  const fetchAssignments = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setAssignments(await getAssignments(userId, roleCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }, [userId, roleCode]);

  useEffect(() => {
    if (!isLoading && userId) void fetchAssignments();
  }, [isLoading, userId, fetchAssignments]);

  if (isLoading) return <LoadingState />;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-7">
        <div>
          <p style={S.label}>Learning</p>
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Assignments</h1>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
            {isManager ? `${assignments.length} assignment${assignments.length !== 1 ? "s" : ""}` : "Your pending and completed assignments"}
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/assignments/new" style={{ ...S.primaryBtn, textDecoration: "none" }}>
            + New Assignment
          </Link>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
        </div>
      ) : assignments.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={S.label}>{isManager ? "No Assignments" : "Nothing Yet"}</p>
          <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>
            {isManager ? "Create your first assignment." : "No assignments have been set for your courses yet."}
          </p>
          {canCreate && (
            <Link href="/dashboard/assignments/new" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
              + New Assignment
            </Link>
          )}
        </div>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
          <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
                {["Title", "Course", "Due", "Status", isManager ? "Submissions" : "Score", ""].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <AssignmentRow key={a.id} assignment={a} isManager={isManager} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ assignment: a, isManager }: { assignment: Assignment; isManager: boolean }) {
  const due      = new Date(a.due_at);
  const isPast   = due < new Date();
  const status   = a.submission_status ?? (isManager ? "—" : "NOT_STARTED");

  return (
    <tr style={{ borderBottom: "1px solid rgba(3,72,82,0.05)" }}>
      <td style={tdStyle}>
        <p style={{ margin: 0, fontWeight: 600, color: "#034852" }}>{a.title}</p>
      </td>
      <td style={tdStyle}>{a.course_title ?? <span style={{ color: "rgba(3,72,82,0.35)" }}>—</span>}</td>
      <td style={tdStyle}>
        <span style={{ color: isPast && status !== "GRADED" ? "#dc2626" : "rgba(3,72,82,0.7)", fontWeight: isPast ? 600 : 400 }}>
          {due.toLocaleDateString()} {due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </td>
      <td style={tdStyle}><StatusBadge status={status} /></td>
      <td style={tdStyle}>
        {isManager ? (
          <Link href={`/dashboard/assignments/${a.id}/submissions`} style={{ fontSize: "12px", color: "#209379", fontWeight: 600, textDecoration: "none" }}>
            View Submissions →
          </Link>
        ) : (
          <span style={{ color: "rgba(3,72,82,0.55)" }}>—</span>
        )}
      </td>
      <td style={tdStyle}>
        <Link
          href={isManager ? `/dashboard/assignments/${a.id}/submissions` : `/dashboard/assignments/${a.id}`}
          style={{ padding: "5px 12px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
        >
          {isManager ? "Grade" : "Open"}
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    NOT_STARTED: { bg: "rgba(3,72,82,0.07)",    color: "rgba(3,72,82,0.5)",  label: "Not Started" },
    SUBMITTED:   { bg: "rgba(10,190,98,0.1)",   color: "#0abe62",            label: "Submitted" },
    LATE:        { bg: "rgba(255,222,0,0.2)",   color: "#956f00",            label: "Late" },
    GRADING:     { bg: "rgba(100,149,237,0.15)", color: "#4169e1",           label: "Grading" },
    GRADED:      { bg: "rgba(10,190,98,0.12)",  color: "#0abe62",            label: "Graded" },
    "—":         { bg: "transparent",           color: "rgba(3,72,82,0.35)", label: "—" },
  };
  const { bg, color, label } = cfg[status] ?? cfg["NOT_STARTED"];
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", background: bg, color }}>
      {label}
    </span>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching assignments…</p>
      </div>
    </div>
  );
}

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" };
const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  primaryBtn: { padding: "11px 22px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", display: "inline-block" } as React.CSSProperties,
};
const thStyle: React.CSSProperties = { padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379", background: "rgba(32,147,121,0.04)" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px" };
