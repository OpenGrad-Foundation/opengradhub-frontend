"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Inbox, Plus, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { type Assignment, type SubmissionQueueRow, type Submission } from "@/lib/api";
import { useAssignments, useSubmissionQueue, useDeleteAssignment } from "@/lib/queries/assignments";
import { GradePanel, StatusBadge } from "@/app/dashboard/assignments/_components/GradePanel";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { Tabs } from "../_components/Tabs";
import workspace from "@/components/dashboard/workspace.module.css";
import styles from "../_components/catalogue.module.css";

export default function AssignmentsPage() {
  const { isLoading } = useCurrentUser();
  const { has } = usePermissions();

  // "Manager view" = can grade submissions. Creating is a separate permission.
  const canGrade  = has(PERM.assignments.grade);
  const canCreate = has(PERM.assignments.create);

  if (isLoading) return <LoadingState />;
  if (canGrade) {
    return (
      <div className={`${workspace.workspace} ${workspace.stickyTabs} ${styles.catalogue}`}>
        <Tabs
          ariaLabel="Assignments tabs"
          compactOnScroll
          tabs={[
            { key: "all", label: "All assignments", compactLabel: "All", panel: <AssignmentsList isManager canCreate={canCreate} /> },
            { key: "queue", label: "Submission queue", compactLabel: "Queue", panel: <SubmissionQueue /> },
          ]}
        />
      </div>
    );
  }
  return <div className={styles.catalogue}><AssignmentsList isManager={false} canCreate={canCreate} /></div>;
}

function AssignmentsList({ isManager, canCreate }: { isManager: boolean; canCreate: boolean }) {
  const { data: assignments = [], isPending, error } = useAssignments();
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase();
  const visible = assignments.filter(a => `${a.title} ${a.course_title ?? ""}`.toLocaleLowerCase().includes(term));

  return (
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="Search assignments" placeholder="Search assignments…" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        {canCreate && <Link href="/dashboard/assignments/new" className={styles.primary}><Plus size={18} aria-hidden="true" />New assignment</Link>}
      </div>

      {isPending ? <LoadingState />
        : error ? <Empty title="Assignments couldn’t be loaded" description={(error as Error).message} />
        : assignments.length === 0 ? <Empty title={isManager ? "No assignments yet" : "Nothing yet"} description={isManager ? "Create an assignment to start collecting submissions." : "No assignments have been set for your courses yet."} />
        : visible.length === 0 ? <Empty title="No matches" description={`No assignments match “${search.trim()}”.`} />
        : <>
          <p role="status" className={styles.resultsLabel}>{visible.length} assignment{visible.length !== 1 ? "s" : ""}</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>{["Title", "Course", "Due", "Status", ""].map(h => <th key={h} scope="col">{h || <span className="sr-only">Actions</span>}</th>)}</tr>
              </thead>
              <tbody>
                {visible.map(a => <AssignmentRow key={a.id} assignment={a} isManager={isManager} />)}
              </tbody>
            </table>
          </div>
        </>}
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
  const openHref = withFrom(isManager ? `/dashboard/assignments/${a.id}/submissions` : `/dashboard/assignments/${a.id}`, currentUrl);

  return (
    <tr>
      <td><Link href={openHref} className={styles.courseTitle}>{a.title}</Link></td>
      <td>{a.course_title ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
      <td style={{ whiteSpace: "nowrap", color: isPast && status !== "GRADED" ? "#b83232" : undefined, fontWeight: isPast && status !== "GRADED" ? 600 : undefined }}>
        {due.toLocaleDateString()} {due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </td>
      <td>{status === "—" ? <span style={{ color: "var(--color-text-muted)" }}>—</span> : <StatusBadge status={status} />}</td>
      <td>
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Link href={openHref} className={styles.secondary}>{isManager ? "Submissions" : "Open"}</Link>
          {canEdit && <Link href={withFrom(`/dashboard/assignments/${a.id}/edit`, currentUrl)} className={styles.secondary}>Edit</Link>}
          {canDelete && (
            <button type="button" title="Deletes the assignment and all of its submissions" onClick={() => setConfirmDelete(true)} className={styles.secondary} style={{ color: "#b83232" }}>
              Delete
            </button>
          )}
        </div>
        {canDelete && confirmDelete && (
          <div role="dialog" aria-modal="true" aria-labelledby={`delete-${a.id}`} style={{ position: "fixed", inset: 0, background: "rgb(3 20 30 / 35%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
            <div style={{ background: "var(--color-surface)", padding: "24px", borderRadius: "12px", border: "1px solid var(--color-border)", maxWidth: "420px", width: "100%", boxShadow: "0 8px 32px rgba(3,72,82,0.16)" }}>
              <h3 id={`delete-${a.id}`} style={{ margin: "0 0 12px", color: "var(--color-text)", fontSize: "18px", fontWeight: 600 }}>Delete assignment?</h3>
              <p style={{ margin: "0 0 24px", color: "var(--color-text-muted)", fontSize: "14px", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--color-text)" }}>{a.title}</strong> and all of its submissions will be deleted. This can’t be undone.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" autoFocus onClick={() => setConfirmDelete(false)} className={styles.secondary}>Cancel</button>
                <button
                  type="button"
                  onClick={() => del.mutate(a.id, { onSettled: () => setConfirmDelete(false) })}
                  disabled={del.isPending}
                  className={styles.primary}
                  style={{ background: "#b83232", borderColor: "#b83232", color: "#fff", opacity: del.isPending ? 0.6 : 1 }}
                >
                  {del.isPending ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function LoadingState() {
  return <div role="status" aria-label="Loading assignments" className={styles.skeleton} style={{ minHeight: "12rem" }}><div /><div /><div /></div>;
}

function Empty({ title, description, icon = <BookOpen size={24} aria-hidden="true" /> }: { title: string; description: string; icon?: React.ReactNode }) {
  return <div className={styles.empty}>{icon}<h2>{title}</h2><p>{description}</p></div>;
}

function SubmissionQueue() {
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

  const groups = Object.values(rows.reduce((acc, row) => {
    if (!acc[row.assignment_id]) {
      acc[row.assignment_id] = {
        assignment_id: row.assignment_id,
        assignment_title: row.assignment_title,
        course_title: row.course_title,
        due_at: row.due_at,
        is_overdue: row.is_overdue,
        rows: [],
      };
    }
    acc[row.assignment_id].rows.push(row);
    return acc;
  }, {} as Record<string, QueueGroup>));

  return (
    <div className={styles.content}>
      <style>{`
        @keyframes gradeSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes gradeFadeIn  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <section aria-label="Submission filters" className={styles.filters}>
        <label className={styles.field}><span>Search</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Student name or roll…" className={styles.control} />
        </label>
        <label className={styles.field}><span>School</span>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={styles.control}>
            <option value="">All schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className={styles.field}><span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={styles.control}>
            <option value="">All statuses</option>
            {QUEUE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", alignSelf: "end", minHeight: "2.75rem", gap: "0.5rem", fontSize: "0.875rem", color: "var(--color-text)", cursor: "pointer" }}>
          <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "var(--teal)" }} /> Overdue only
        </label>
      </section>

      {isPending ? <LoadingState />
        : error ? <Empty title="Queue couldn’t be loaded" description={(error as Error).message} />
        : rows.length === 0 ? <Empty icon={<Inbox size={24} aria-hidden="true" />} title="Nothing to grade" description="No submissions match these filters." />
        : <>
          <p role="status" className={styles.resultsLabel}>{rows.length} student{rows.length !== 1 ? "s" : ""} across {groups.length} assignment{groups.length !== 1 ? "s" : ""}</p>
          <div style={{ display: "grid", gap: "12px" }}>
            {groups.map((group) => <SubmissionQueueGroup key={group.assignment_id} group={group} active={active} setActive={setActive} />)}
          </div>
        </>}

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

const QUEUE_STATUSES = [["NOT_STARTED", "Not started"], ["SUBMITTED", "Submitted"], ["LATE", "Late"], ["GRADING", "Under review"], ["GRADED", "Graded"]] as const;

type QueueGroup = { assignment_id: string; assignment_title: string; course_title: string | null; due_at: string; is_overdue: boolean; rows: SubmissionQueueRow[] };

function SubmissionQueueGroup({ group, active, setActive }: { group: QueueGroup; active: SubmissionQueueRow | null; setActive: (r: SubmissionQueueRow | null) => void }) {
  const [expanded, setExpanded] = useState(false);
  const due = new Date(group.due_at);
  const submitted = group.rows.filter(r => r.submission_id).length;
  const panelId = `queue-${group.assignment_id}`;

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={panelId}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "16px 20px", textAlign: "left", cursor: "pointer", borderBottom: expanded ? "1px solid var(--color-border)" : "none" }}
      >
        <span style={{ display: "grid", gap: "6px", minWidth: 0 }}>
          <strong style={{ fontWeight: 600, fontSize: "15px", color: "var(--color-text)", overflowWrap: "anywhere" }}>{group.assignment_title}</strong>
          <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: "13px", color: "var(--color-text-muted)" }}>
            {group.course_title && <span>{group.course_title}</span>}
            <span style={{ whiteSpace: "nowrap", color: group.is_overdue ? "#b83232" : undefined, fontWeight: group.is_overdue ? 600 : undefined }}>
              {group.is_overdue ? "Overdue · " : "Due "}{due.toLocaleDateString()} {due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>{submitted}/{group.rows.length} submitted</span>
          </span>
        </span>
        <ChevronDown size={18} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text-muted)", transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 180ms ease-out" }} />
      </button>
      {expanded && (
        <div id={panelId} style={{ overflowX: "auto" }}>
          <table className={styles.table} style={{ minWidth: "32rem" }}>
            <thead>
              <tr>{["Student", "School", "Status", ""].map((h) => <th key={h} scope="col">{h || <span className="sr-only">Actions</span>}</th>)}</tr>
            </thead>
            <tbody>
              {group.rows.map((r) => {
                const isActive = active?.submission_id != null && active.submission_id === r.submission_id;
                return (
                  <tr key={`${r.assignment_id}:${r.student_id}`}>
                    <td>
                      <strong style={{ fontWeight: 600, color: "var(--color-text)" }}>{r.student_name ?? "—"}</strong>
                      {r.student_roll && <span style={{ color: "var(--color-text-muted)" }}> · {r.student_roll}</span>}
                    </td>
                    <td>{r.school_name ?? "—"}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      {r.submission_id
                        ? <button type="button" onClick={() => setActive(isActive ? null : r)} className={styles.secondary}>{isActive ? "Close" : "Grade"}</button>
                        : <span style={{ color: "var(--color-text-muted)", fontSize: "12px" }}>Not submitted</span>}
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
