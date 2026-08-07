"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { type Assignment, type SubmissionQueueRow, type Submission } from "@/lib/api";
import { useAssignments, useSubmissionQueue, useDeleteAssignment } from "@/lib/queries/assignments";
import { GradePanel, StatusBadge } from "@/app/dashboard/assignments/_components/GradePanel";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

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
  const currentUrl = useCurrentUrl();
  const { has } = usePermissions();
  const canEdit   = has(PERM.assignments.edit);
  const canDelete = has(PERM.assignments.delete);
  const del = useDeleteAssignment();
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          <Link href={withFrom(`/dashboard/assignments/${a.id}/submissions`, currentUrl)} style={{ fontSize: "12px", color: "#209379", fontWeight: 600, textDecoration: "none" }}>
            View Submissions →
          </Link>
        ) : (
          <span style={{ color: "rgba(3,72,82,0.55)" }}>—</span>
        )}
      </td>
      <td style={tdStyle}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <Link
            href={withFrom(isManager ? `/dashboard/assignments/${a.id}/submissions` : `/dashboard/assignments/${a.id}`, currentUrl)}
            style={{ padding: "5px 12px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
          >
            {isManager ? "Grade" : "Open"}
          </Link>

          {canEdit && (
            <Link
              href={withFrom(`/dashboard/assignments/${a.id}/edit`, currentUrl)}
              style={{ padding: "5px 12px", border: "1.5px solid rgba(32,147,121,0.3)", borderRadius: "8px", background: "transparent", color: "#209379", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}
            >
              Edit
            </Link>
          )}

          {canDelete && (
            <button
              type="button"
              title="Deletes the assignment and all of its submissions"
              onClick={() => setConfirmDelete(true)}
              style={{ padding: "5px 12px", border: "1.5px solid rgba(220,38,38,0.3)", borderRadius: "8px", background: "transparent", color: "#dc2626", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              Delete
            </button>
          )}

          {canDelete && confirmDelete && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
              <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", maxWidth: "400px", width: "90%", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#034852", fontSize: "18px", fontWeight: 700 }}>Delete Assignment</h3>
                <p style={{ margin: "0 0 24px 0", color: "#4a5568", fontSize: "14px", lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong>{a.title}</strong>? This action cannot be undone and will delete all associated submissions.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{ padding: "8px 16px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => del.mutate(a.id, { onSettled: () => setConfirmDelete(false) })}
                    disabled={del.isPending}
                    style={{ padding: "8px 16px", border: "none", borderRadius: "8px", background: "#dc2626", color: "#fff", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: del.isPending ? 0.6 : 1 }}
                  >
                    {del.isPending ? "Deleting..." : "Delete Assignment"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
        response_text: active.response_text,
        file_urls: active.file_urls ?? [],
        link_url: active.link_url,
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
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={{ ...filterInput, flex: "1 1 140px" }}>
            <option value="">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...filterInput, flex: "1 1 120px" }}>
            <option value="">All statuses</option>
            {["NOT_STARTED", "SUBMITTED", "LATE", "GRADING", "GRADED"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#034852", fontWeight: 600 }}>
            <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only
          </label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student…" style={{ ...filterInput, flex: "1 1 160px", minWidth: 0 }} />
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
          <div>
            {Object.values(rows.reduce((acc, row) => {
              if (!acc[row.assignment_id]) {
                acc[row.assignment_id] = {
                  assignment_id: row.assignment_id,
                  assignment_title: row.assignment_title,
                  course_title: row.course_title,
                  due_at: row.due_at,
                  is_overdue: row.is_overdue,
                  rows: []
                };
              }
              acc[row.assignment_id].rows.push(row);
              return acc;
            }, {} as Record<string, { assignment_id: string; assignment_title: string; course_title: string | null; due_at: string; is_overdue: boolean; rows: typeof rows }>)).map((group) => (
              <SubmissionQueueGroup key={group.assignment_id} group={group} active={active} setActive={setActive} />
            ))}
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
  maxWidth: "100%", textOverflow: "ellipsis"
};

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" };
const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  primaryBtn: { padding: "11px 22px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", display: "inline-block" } as React.CSSProperties,
};
const thStyle: React.CSSProperties = { padding: "12px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379", background: "rgba(32,147,121,0.04)" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px" };

function SubmissionQueueGroup({ group, active, setActive }: { group: any; active: SubmissionQueueRow | null; setActive: (r: SubmissionQueueRow | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  const due = new Date(group.due_at);

  return (
    <div style={{ ...glassCard, padding: 0, overflow: "hidden", marginBottom: "20px" }}>
      <div 
        onClick={() => setExpanded(e => !e)}
        style={{ padding: "16px 20px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer", background: expanded ? "linear-gradient(135deg, rgba(3,72,82,0.03) 0%, rgba(10,190,98,0.03) 100%)" : "transparent", borderBottom: expanded ? "1px solid rgba(3,72,82,0.08)" : "none", transition: "background 150ms ease", gap: "16px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: "1 1 200px" }}>
          <p style={{ margin: 0, fontWeight: 800, color: "#034852", fontSize: "15px", lineHeight: 1.4 }}>{group.assignment_title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", fontSize: "12px", color: "rgba(3,72,82,0.55)", fontWeight: 600 }}>
            {group.course_title && <span>{group.course_title}</span>}
            {group.course_title && <span>·</span>}
            <span style={{ whiteSpace: "nowrap" }}>Due <strong style={{ color: group.is_overdue ? "#dc2626" : "inherit" }}>{due.toLocaleDateString()} {due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong></span>
            {group.is_overdue && <span style={{ padding: "1px 6px", borderRadius: "6px", fontSize: "9px", fontWeight: 800, background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>OVERDUE</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, marginTop: "2px" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.5)" }}>{group.rows.length} {group.rows.length === 1 ? 'student' : 'students'}</span>
          <button style={{ padding: "6px 12px", background: "rgba(32,147,121,0.08)", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: 700, color: "#209379", cursor: "pointer" }}>
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px", minWidth: "500px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(3,72,82,0.08)" }}>
                {["Student", "School", "Status", ""].map((h) => <th key={h} style={thStyle}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r: SubmissionQueueRow) => {
                const isActive = active?.submission_id != null && active.submission_id === r.submission_id;
                return (
                  <tr key={`${r.assignment_id}:${r.student_id}`} style={{ borderBottom: "1px solid rgba(3,72,82,0.05)", background: isActive ? "rgba(10,190,98,0.04)" : "transparent", transition: "background 150ms ease" }}>
                    <td style={tdStyle}>
                      <strong style={{ color: "#034852" }}>{r.student_name ?? "—"}</strong>
                      {r.student_roll && <span style={{ color: "rgba(3,72,82,0.4)" }}> · {r.student_roll}</span>}
                    </td>
                    <td style={tdStyle}>{r.school_name ?? "—"}</td>
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
      )}
    </div>
  );
}
