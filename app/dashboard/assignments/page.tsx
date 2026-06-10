"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { type Assignment, type SubmissionQueueRow, type Submission } from "@/lib/api";
import { useAssignments, useSubmissionQueue } from "@/lib/queries/assignments";
import { GradePanel, StatusBadge } from "@/app/dashboard/assignments/_components/GradePanel";

export default function AssignmentsPage() {
  const { isLoading } = useCurrentUser();
  const { has } = usePermissions();

  // "Manager view" = can grade submissions. Creating is a separate permission.
  const canGrade  = has(PERM.assignments.grade);
  const canCreate = has(PERM.assignments.create);
  const isManager = canGrade;

  const { data: assignments = [], isPending, error: queryError } = useAssignments();
  const loading = isPending;
  const error = queryError ? (queryError as Error).message : null;

  if (isLoading) return <LoadingState />;
  if (isManager) {
    return <ManagerAssignmentsView canCreate={canCreate} />;
  }

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

function ManagerAssignmentsView({ canCreate }: { canCreate: boolean }) {
  const [tab, setTab] = useState<"all" | "queue">("all");

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <p style={S.label}>Assignments</p>
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Assignments</h1>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
            All assignments you manage, and the queue of submissions to grade.
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/assignments/new" style={{ ...S.primaryBtn, textDecoration: "none" }}>
            + New Assignment
          </Link>
        )}
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "18px" }}>
        {([["all", "All assignments"], ["queue", "Submission queue"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: "9px 16px",
              borderRadius: "10px",
              border: "1px solid " + (tab === key ? "rgba(32,147,121,0.3)" : "rgba(3,72,82,0.12)"),
              background: tab === key ? "linear-gradient(135deg, rgba(10,190,98,0.16), rgba(32,147,121,0.16))" : "#fff",
              color: tab === key ? "#034852" : "rgba(3,72,82,0.6)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "all" ? <ManagerAssignmentsList /> : <SubmissionQueue canCreate={false} />}
    </div>
  );
}

function ManagerAssignmentsList() {
  const { data: assignments = [], isPending, error: queryError } = useAssignments();
  const error = queryError ? (queryError as Error).message : null;

  if (isPending) return <LoadingState />;
  if (error) {
    return (
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
      </div>
    );
  }
  if (assignments.length === 0) {
    return (
      <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
        <p style={S.label}>No Assignments</p>
        <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>Create your first assignment.</p>
      </div>
    );
  }

  return (
    <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
              {["Title", "Course", "Due", "Status", "Submissions", ""].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <AssignmentRow key={a.id} assignment={a} isManager={true} />
            ))}
          </tbody>
        </table>
      </div>
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

function SubmissionQueue({ canCreate }: { canCreate: boolean }) {
  const { data: userData } = useCurrentUser();
  const graderId = userData?.user?.id ?? "";

  const [schoolId, setSchoolId] = useState("");
  const [overdue, setOverdue]   = useState(false);
  const [status, setStatus]     = useState("");
  const [q, setQ]               = useState("");
  const [active, setActive]     = useState<SubmissionQueueRow | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active]);

  const { data, isPending, error, refetch } = useSubmissionQueue({
    schoolId: schoolId || undefined,
    overdue:  overdue || undefined,
    status:   status || undefined,
    q:        q || undefined,
  });

  const rows = data?.rows ?? [];
  const schools = data?.schools ?? [];

  // Build a Submission object for GradePanel from the active queue row.
  const activeSubmission: Submission | null = active && active.submission_id
    ? {
        id: active.submission_id,
        assignment_id: active.assignment_id,
        student_id: active.student_id,
        student_name: active.student_name,
        student_roll: active.student_roll,
        response_text: null,
        file_urls: [],
        status: active.status,
        submitted_at: active.submitted_at,
        is_late: active.is_late,
        score: active.score,
        feedback: null,
        graded_by: null,
        graded_at: null,
      }
    : null;

  return (
    <div>
      <style>{`
        @keyframes gradeSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes gradeFadeIn  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <p style={S.label}>Grading</p>
            <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Submission Queue</h1>
            <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
              {rows.length} obligation{rows.length !== 1 ? "s" : ""}
            </p>
          </div>
          {canCreate && (
            <Link href="/dashboard/assignments/new" style={{ ...S.primaryBtn, textDecoration: "none" }}>
              + New Assignment
            </Link>
          )}
        </div>

        <div style={{ ...glassCard, padding: "14px 18px", marginBottom: "16px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={filterInput}>
            <option value="">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={filterInput}>
            <option value="">All statuses</option>
            {["NOT_STARTED", "SUBMITTED", "LATE", "GRADING", "GRADED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#034852", fontWeight: 600 }}>
            <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student…" style={{ ...filterInput, flex: 1, minWidth: "160px" }} />
        </div>

        {isPending ? (
          <div style={{ ...glassCard, textAlign: "center", padding: "40px" }}><p style={S.label}>Loading…</p></div>
        ) : error ? (
          <div style={{ ...glassCard, textAlign: "center" }}><p style={{ color: "#e53e3e", fontWeight: 600 }}>{(error as Error).message}</p></div>
        ) : rows.length === 0 ? (
          <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
            <p style={S.label}>Nothing Here</p>
            <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>No submissions match your filters.</p>
          </div>
        ) : (
          <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
                    {["Student", "School", "Assignment", "Due", "Status", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const due = new Date(r.due_at);
                    const isActive = active?.submission_id != null && active.submission_id === r.submission_id;
                    return (
                      <tr key={`${r.assignment_id}:${r.student_id}`} style={{ borderBottom: "1px solid rgba(3,72,82,0.05)", background: isActive ? "rgba(10,190,98,0.04)" : "transparent" }}>
                        <td style={tdStyle}><strong style={{ color: "#034852" }}>{r.student_name ?? "—"}</strong>{r.student_roll ? <span style={{ color: "rgba(3,72,82,0.4)" }}> · {r.student_roll}</span> : null}</td>
                        <td style={tdStyle}>{r.school_name ?? "—"}</td>
                        <td style={tdStyle}>{r.assignment_title}{r.course_title ? <span style={{ color: "rgba(3,72,82,0.4)" }}> · {r.course_title}</span> : null}</td>
                        <td style={tdStyle}>
                          <span style={{ color: r.is_overdue ? "#dc2626" : "rgba(3,72,82,0.7)", fontWeight: r.is_overdue ? 700 : 400 }}>
                            {due.toLocaleDateString()}
                          </span>
                          {r.is_overdue && <span style={{ marginLeft: "6px", padding: "1px 6px", borderRadius: "6px", fontSize: "9px", fontWeight: 700, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>OVERDUE</span>}
                        </td>
                        <td style={tdStyle}><StatusBadge status={r.status} /></td>
                        <td style={tdStyle}>
                          {r.submission_id ? (
                            <button onClick={() => setActive(isActive ? null : r)} style={{ padding: "5px 12px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                              {isActive ? "Close" : "Grade"}
                            </button>
                          ) : (
                            <span style={{ color: "rgba(3,72,82,0.35)", fontSize: "12px" }}>Not submitted</span>
                          )}
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

      {activeSubmission && (
        <>
          <div
            onClick={() => setActive(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(3,72,82,0.25)",
              backdropFilter: "blur(2px)",
              zIndex: 50,
              animation: "gradeFadeIn 180ms ease-out",
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(460px, 100vw)",
              background: "#f8fafa",
              boxShadow: "-12px 0 36px rgba(3,72,82,0.18)",
              overflowY: "auto",
              zIndex: 51,
              padding: "24px",
              animation: "gradeSlideIn 280ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <GradePanel
              key={activeSubmission.id}
              submission={activeSubmission}
              assignmentId={activeSubmission.assignment_id}
              graderId={graderId}
              onSaved={async () => { await refetch(); }}
              onClose={() => setActive(null)}
            />
          </aside>
        </>
      )}
    </div>
  );
}

const filterInput: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid rgba(3,72,82,0.15)", borderRadius: "8px",
  fontSize: "13px", color: "#034852", background: "#fff", outline: "none",
};

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" };
const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  primaryBtn: { padding: "11px 22px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", display: "inline-block" } as React.CSSProperties,
};
const thStyle: React.CSSProperties = { padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379", background: "rgba(32,147,121,0.04)" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px" };
