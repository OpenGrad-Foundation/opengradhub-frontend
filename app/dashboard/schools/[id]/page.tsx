"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { IN_CHARGE } from "@/lib/labels";
import {
  fetchSchoolRosterDetail,
  getSchoolDetail,
  updateUser,
  type SchoolRosterDetail,
  type SchoolRosterStudent,
  type SchoolDetail as SchoolAnalytics,
} from "@/lib/api";
import { EntityLink } from "../../programmes/_components/entity-link";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { usePermissions } from "@/hooks/use-permission";
import { PERM, ANALYTICS_DASHBOARD_PERMISSIONS, STUDENT_PROFILE_PERMISSIONS } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { SchoolFormModal } from "../SchoolFormModal";
import { AddStudentsPanel } from "./AddStudentsPanel";
import { AttachBatchPanel } from "./AttachBatchPanel";
import { AttendancePanel } from "./AttendancePanel";
import { SchoolBatchList } from "./SchoolBatchList";
import {
  labelStyle, titleStyle, primaryButton, secondaryButton, thStyle, tdStyle, linkBtnStyle, inputStyle,
} from "../styles";

/** Section tabs. Batches/Students/Attendance used to stack, which buried
 *  attendance below a 400-row roster. */
const TABS = [
  { key: "students", label: "Students" },
  { key: "batches", label: "Batches" },
  { key: "attendance", label: "Attendance" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    border: "none",
    borderRadius: "10px",
    background: active ? "rgba(10,190,98,0.12)" : "transparent",
    color: active ? "#046b45" : "rgba(3,72,82,0.65)",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentUrl = useCurrentUrl();
  const { has } = usePermissions();
  const canEditSchool = has(PERM.schools.edit);
  const canViewStudents = has(PERM.students.view);
  const canViewStudentContacts = canViewStudents && has(PERM.students.view_contact);
  const canViewStaffContacts = has(PERM.staff.view_contacts);
  const canViewAnalytics = canViewStudents && ANALYTICS_DASHBOARD_PERMISSIONS.some(has);
  const canEditRoster = has(PERM.user_management.edit) && canViewStudents;
  const canAttachBatch = has(PERM.batches.edit);
  const canViewAttendance = has(PERM.attendance.view) && has(PERM.students.view);
  const invalidate = useInvalidate();

  const [detail, setDetail] = useState<SchoolRosterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const [analytics, setAnalytics] = useState<SchoolAnalytics | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("students");
  const [studentQuery, setStudentQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await fetchSchoolRosterDetail(id);
      setDetail(d);
      hasLoadedRef.current = true;
      setError(null);
      setRosterError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load school.";
      // A failed refetch must not unmount the page (or an open panel) when we
      // already have data — surface it inline instead.
      if (hasLoadedRef.current) setRosterError(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (canViewStudents) void load(); }, [load, canViewStudents]);

  // Only request learning analytics when the caller holds that capability.
  useEffect(() => {
    if (!canViewAnalytics) { setAnalytics(null); return; }
    let cancelled = false;
    getSchoolDetail(id)
      .then((a) => { if (!cancelled) setAnalytics(a); })
      .catch(() => { if (!cancelled) setAnalytics(null); });
    return () => { cancelled = true; };
  }, [id, canViewAnalytics]);

  async function removeStudent(studentId: string) {
    setRemovingId(studentId);
    setRosterError(null);
    try {
      // "" → NULL on the backend (users.service: school_id = patch.school_id || null)
      await updateUser(studentId, { school_id: "" });
      invalidate("schools", "users");
      setConfirmRemoveId(null);
      await load();
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "Failed to remove student.");
    } finally {
      setRemovingId(null);
    }
  }

  if (!canViewStudents) return <div>
    <BackLink fallback="/dashboard/schools" style={backLinkStyle} />
    <p style={{ color: "rgba(3,72,82,0.6)", marginTop: 16 }}>Viewing school details requires permission to view students.</p>
  </div>;

  if (loading) return <p style={{ color: "rgba(3,72,82,0.6)" }}>Loading school…</p>;

  if (error || !detail) {
    return (
      <div>
        <BackLink fallback="/dashboard/schools" style={backLinkStyle} />
        <p style={{ color: "#c53030", fontWeight: 600, marginTop: "16px" }}>
          {error ?? "School not found."}
        </p>
      </div>
    );
  }

  const { school, stats, students } = detail;
  const schoolStudentIds = new Set(students.map((s) => s.id));
  const q = studentQuery.trim().toLowerCase();
  const visibleStudents = q
    ? students.filter((st) =>
        [st.name, st.roll_number, canViewStudentContacts ? st.email : null, st.programme]
          .some((v) => v?.toLowerCase().includes(q)))
    : students;

  const tableProps = {
    schoolStudentIds,
    canViewStudentContacts,
    canEditRoster,
    confirmRemoveId,
    removingId,
    onRemove: (studentId: string) => void removeStudent(studentId),
    onConfirmRemove: (studentId: string) => setConfirmRemoveId(studentId),
    onCancelRemove: () => { setConfirmRemoveId(null); setRosterError(null); },
  };

  return (
    <div>
      <BackLink fallback="/dashboard/schools" style={backLinkStyle} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between" style={{ margin: "12px 0 24px" }}>
        <div>
          <p style={labelStyle}>School</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: "4px 0 8px" }}>{school.name}</h1>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {school.code && <span style={chipStyle}>{school.code}</span>}
            {school.state && <span style={chipStyle}>{school.state}</span>}
            {school.district && <span style={chipStyle}>{school.district}</span>}
          </div>
        </div>
        {canEditSchool && (
          <button onClick={() => setShowEdit(true)} style={secondaryButton}>Edit School</button>
        )}
      </div>

      {showEdit && (
        <SchoolFormModal
          mode="edit"
          school={school}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); void load(); }}
        />
      )}

      {/* Fellow + stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Assigned {IN_CHARGE}</p>
          {school.fellow_name ? (
            <>
              <p style={cardValueStyle}>{school.fellow_name}</p>
              {canViewStaffContacts && school.fellow_email && (
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>{school.fellow_email}</p>
              )}
            </>
          ) : (
            <p style={{ ...cardValueStyle, color: "rgba(3,72,82,0.45)" }}>Unassigned</p>
          )}
        </div>
        <div style={cardStyle}>
          <p style={cardLabelStyle}>Students</p>
          <p style={cardValueStyle}>{stats.student_count}</p>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {stats.programmes.map((p) => (
              <span key={p.programme ?? "none"} style={chipStyle}>
                {p.programme ?? "No programme"}: {p.count}
              </span>
            ))}
          </div>
        </div>
        {analytics && (
          <div style={cardStyle}>
            <p style={cardLabelStyle}>Avg Completion</p>
            <p style={cardValueStyle}>{analytics.avg_completion}%</p>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.6)" }}>
              {analytics.at_risk_count} at-risk student{analytics.at_risk_count === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>

      {/* Analytics: section scores */}
      {analytics && analytics.section_scores.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: "24px" }}>
          <p style={cardLabelStyle}>Avg Quiz Score by Section</p>
          <div style={{ display: "grid", gap: "8px" }}>
            {analytics.section_scores.slice(0, 8).map((row) => (
              <div key={row.section} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ flex: "0 0 220px", fontSize: "13px", color: "#034852", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.section}
                </span>
                <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(3,72,82,0.08)" }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, row.avg_score))}%`, height: "100%", borderRadius: "4px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)" }} />
                </div>
                <span style={{ flex: "0 0 48px", fontSize: "13px", fontWeight: 700, color: "#034852", textAlign: "right" }}>
                  {row.avg_score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: these three sections are each long, so they page instead of stack. */}
      <div
        role="tablist"
        aria-label="School sections"
        style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid rgba(3,72,82,0.08)", paddingBottom: 8, marginBottom: 20 }}
      >
        {TABS.filter((t) => t.key !== "attendance" || canViewAttendance).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            style={tabStyle(tab === t.key)}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "batches" ? ` (${detail.batches.length})` : t.key === "students" ? ` (${stats.student_count})` : ""}
          </button>
        ))}
      </div>

      {/* Batches hosted at this school. The roster of each one lives on the
          batch page, so a row is a link, not a disclosure. */}
      {tab === "batches" && <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <h2 style={{ ...titleStyle, fontSize: "18px", margin: 0 }}>Batches</h2>
          {canAttachBatch && (
            <button onClick={() => setShowAddBatch(true)} style={secondaryButton}>+ Add Batch</button>
          )}
        </div>

        {showAddBatch && (
          <AttachBatchPanel
            schoolId={school.id}
            schoolName={school.name}
            onClose={() => setShowAddBatch(false)}
            onChanged={() => void load()}
          />
        )}

        <SchoolBatchList batches={detail.batches} currentUrl={currentUrl} canOpen={has(PERM.batches.view)} showStudentCounts={canViewStudents} />
      </>}

      {/* Roster identity and contacts have independent data grants. */}
      {tab === "students" && <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
          <h2 style={{ ...titleStyle, fontSize: "18px", margin: 0 }}>
            Students{q ? ` · ${visibleStudents.length} match${visibleStudents.length === 1 ? "" : "es"}` : ""}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 240px", justifyContent: "flex-end" }}>
            <input
              type="search"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder={canViewStudentContacts ? "Search name, roll number, email…" : "Search name or roll number…"}
              aria-label="Search students"
              style={{ ...inputStyle, maxWidth: "320px", padding: "8px 14px" }}
            />
            {canEditRoster && (
              <button onClick={() => setShowAdd(true)} style={{ ...primaryButton, whiteSpace: "nowrap" }}>+ Add Students</button>
            )}
          </div>
        </div>

        {rosterError && (
          <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px" }}>{rosterError}</p>
        )}

        <RosterTable
          rows={visibleStudents}
          emptyMessage={q ? "No students match this search." : "No students assigned to this school yet."}
          {...tableProps}
        />
      </>}

      {/* Committed register attendance for this school — read-only; uploading
          still lives in the Attendance tab. */}
      {tab === "attendance" && (
        <AttendancePanel schoolId={school.id} canView={canViewAttendance} defaultOpen />
      )}

      {showAdd && (
        <AddStudentsPanel
          schoolId={school.id}
          schoolName={school.name}
          currentStudentIds={students.map((s) => s.id)}
          onClose={() => setShowAdd(false)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

/**
 * Shared roster table. Remove only renders for rows whose student is in the
 * school roster (`schoolStudentIds`) — batch members from other schools get
 * an em-dash in the action cell.
 */
function RosterTable({
  rows,
  schoolStudentIds,
  emptyMessage,
  canEditRoster,
  canViewStudentContacts,
  confirmRemoveId,
  removingId,
  onRemove,
  onConfirmRemove,
  onCancelRemove,
}: {
  rows: SchoolRosterStudent[];
  schoolStudentIds: Set<string>;
  emptyMessage: string;
  canEditRoster: boolean;
  canViewStudentContacts: boolean;
  confirmRemoveId: string | null;
  removingId: string | null;
  onRemove: (studentId: string) => void;
  onConfirmRemove: (studentId: string) => void;
  onCancelRemove: () => void;
}) {
  return (
    <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
        <thead>
          <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Roll Number</th>
            {canViewStudentContacts && <th style={thStyle}>Email</th>}
            <th style={thStyle}>Programme</th>
            {canEditRoster && <th style={thStyle} />}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3 + Number(canEditRoster) + Number(canViewStudentContacts)} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((st) => (
            <tr key={st.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
              <td style={tdStyle}><EntityLink href={`/dashboard/students/${st.id}`} permissions={STUDENT_PROFILE_PERMISSIONS} requiredPermissions={[PERM.students.view]}>{st.name}</EntityLink></td>
              <td style={tdStyle}>{st.roll_number ?? "—"}</td>
              {canViewStudentContacts && <td style={tdStyle}>{st.email ?? "—"}</td>}
              <td style={tdStyle}>{st.programme ?? "—"}</td>
              {canEditRoster && (
                <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  {!schoolStudentIds.has(st.id) ? (
                    <span style={{ color: "rgba(3,72,82,0.35)" }}>—</span>
                  ) : confirmRemoveId === st.id ? (
                    <>
                      <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.7)", marginRight: "8px" }}>
                        Remove from school?
                      </span>
                      <button
                        onClick={() => onRemove(st.id)}
                        disabled={removingId === st.id}
                        style={{ ...linkBtnStyle, color: "#c53030", opacity: removingId === st.id ? 0.5 : 1 }}
                      >
                        {removingId === st.id ? "Removing…" : "Yes"}
                      </button>
                      <button onClick={onCancelRemove} style={{ ...linkBtnStyle, marginLeft: "8px" }}>
                        No
                      </button>
                    </>
                  ) : (
                    <button onClick={() => onConfirmRemove(st.id)} style={{ ...linkBtnStyle, color: "#c53030" }}>
                      Remove
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const backLinkStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 700, color: "#0abe62", textDecoration: "none" };
const chipStyle: React.CSSProperties = { display: "inline-block", padding: "4px 10px", borderRadius: "999px", background: "rgba(3,72,82,0.06)", fontSize: "12px", fontWeight: 600, color: "#034852" };
const cardStyle: React.CSSProperties = { padding: "20px", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" };
const cardLabelStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
const cardValueStyle: React.CSSProperties = { margin: "0 0 6px", fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 700, color: "#034852" };
