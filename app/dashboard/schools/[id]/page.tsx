"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Layers, Search, MapPin, Pencil, Plus, School as SchoolIcon, UserRound, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { IN_CHARGE, ROLE_LABELS } from "@/lib/labels";
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
import { Tabs } from "../../_components/Tabs";
import workspace from "@/components/dashboard/workspace.module.css";
import styles from "../../_components/catalogue.module.css";
import css from "../schools.module.css";

/** Section tabs. Batches/Students/Attendance used to stack, which buried
 *  attendance below a 400-row roster. */
const TABS = [
  { key: "students", label: "Students" },
  { key: "batches", label: "Batches" },
  { key: "attendance", label: "Attendance" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

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

  const backLink = <BackLink fallback="/dashboard/schools" className={styles.secondary}><ArrowLeft size={16} aria-hidden="true" /><span><span className="hidden sm:inline">Back to </span>Schools</span></BackLink>;

  if (!canViewStudents) return <div className={`${styles.catalogue} ${css.page}`}>
    <div className={css.header}><div className={css.headerToolbar}>{backLink}</div></div>
    <section className={styles.empty}>
      <SchoolIcon size={28} aria-hidden="true" />
      <p>Viewing school details requires permission to view students.</p>
    </section>
  </div>;

  if (loading) return <div className={`${styles.catalogue} ${css.page}`} role="status" aria-label="Loading school">
    <div className={css.header}><div className={css.headerToolbar}>{backLink}</div></div>
    <div className={css.skeletonRows} aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} />)}</div>
  </div>;

  if (error || !detail) {
    return (
      <div className={`${styles.catalogue} ${css.page}`}>
        <div className={css.header}><div className={css.headerToolbar}>{backLink}</div></div>
        <section role="alert" className={styles.empty}>
          <SchoolIcon size={28} aria-hidden="true" />
          <h2>School unavailable</h2>
          <p>{error ?? "School not found."}</p>
        </section>
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

  const visibleTabs = TABS.filter((t) => t.key !== "attendance" || canViewAttendance);

  const panel = <>
    {/* Batches hosted at this school. The roster of each one lives on the
        batch page, so a row is a link, not a disclosure. */}
    {tab === "batches" && <>
      <div className={styles.resultsBar}>
        <p className={styles.resultsLabel}>{detail.batches.length} batch{detail.batches.length === 1 ? "" : "es"} at this school</p>
        {canAttachBatch && (
          <button type="button" onClick={() => setShowAddBatch(true)} className={styles.secondary}><Plus size={18} aria-hidden="true" />Add batch</button>
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
      <div className={css.sectionBar}>
        <p role="status" className={styles.resultsLabel}>
          {q
            ? `${visibleStudents.length} match${visibleStudents.length === 1 ? "" : "es"} of ${students.length}`
            : `${students.length} student${students.length === 1 ? "" : "s"}`}
        </p>
        <div className={css.sectionTools}>
          <label className={styles.search}>
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder={canViewStudentContacts ? "Search name, roll number, email…" : "Search name or roll number…"}
              aria-label="Search students"
            />
          </label>
          {canEditRoster && (
            <button type="button" onClick={() => setShowAdd(true)} className={styles.primary}><Plus size={18} aria-hidden="true" />Add students</button>
          )}
        </div>
      </div>

      {rosterError && <p role="alert" className={css.error}>{rosterError}</p>}

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
  </>;

  const location = [school.district, school.state].filter(Boolean).join(", ");
  const programmeMix = stats.programmes.map((p) => `${p.programme ?? "No programme"}: ${p.count}`).join(" · ");

  return (
    <div className={`${workspace.workspace} ${styles.catalogue} ${css.page}`}>
      <div className={css.header}>
        <div className={css.headerToolbar}>
          {backLink}
          {canEditSchool && (
            <div className={css.headerActions}>
              <button type="button" onClick={() => setShowEdit(true)} className={styles.secondary}><Pencil size={16} aria-hidden="true" />Edit school</button>
            </div>
          )}
        </div>
        <div className={css.identity}>
          <h2>{school.name}</h2>
          <div className={css.meta}>
            {school.code && <span className={css.code}>{school.code}</span>}
            {location && <span><MapPin size={14} aria-hidden="true" />{location}</span>}
            <span>
              <UserRound size={14} aria-hidden="true" />
              {IN_CHARGE}: <strong>{school.fellow_name ?? "Unassigned"}</strong>
              {canViewStaffContacts && school.fellow_name && school.fellow_email && <span className={css.contact}>{school.fellow_email}</span>}
            </span>
            <span>
              <UserRound size={14} aria-hidden="true" />
              {ROLE_LABELS.ZONAL_MANAGER}: <strong>{school.zm_name ?? "—"}</strong>
              {canViewStaffContacts && school.zm_name && school.zm_email && <span className={css.contact}>{school.zm_email}</span>}
            </span>
          </div>
        </div>
      </div>

      {showEdit && (
        <SchoolFormModal
          mode="edit"
          school={school}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); void load(); }}
        />
      )}

      <div className={css.metrics}>
        <div className={css.metric}>
          <span className={css.metricLabel}><Users size={14} aria-hidden="true" />Students</span>
          <span className={css.metricValue}>{stats.student_count}</span>
          {programmeMix && <span className={css.metricFoot}>{programmeMix}</span>}
        </div>
        <div className={css.metric}>
          <span className={css.metricLabel}><Layers size={14} aria-hidden="true" />Batches</span>
          <span className={css.metricValue}>{detail.batches.length}</span>
        </div>
        {analytics && (
          <div className={css.metric}>
            <span className={css.metricLabel}>Avg completion</span>
            <span className={css.metricValue}>{analytics.avg_completion}%</span>
            <span className={css.metricFoot}>{analytics.at_risk_count} at-risk student{analytics.at_risk_count === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>

      {analytics && analytics.section_scores.length > 0 && (
        <section className={css.panel}>
          <h3>Avg quiz score by section</h3>
          {analytics.section_scores.slice(0, 8).map((row) => (
            <div key={row.section} className={css.scoreRow}>
              <span className={css.scoreName} title={row.section}>{row.section}</span>
              <div className={css.bar}><div style={{ width: `${Math.min(100, Math.max(0, row.avg_score))}%` }} /></div>
              <span className={css.scoreValue}>{row.avg_score}%</span>
            </div>
          ))}
        </section>
      )}

      {/* Tabs: these three sections are each long, so they page instead of stack. */}
      <div className={`${workspace.stickyTabs} ${css.tabs}`}>
        <Tabs
          ariaLabel="School sections"
          compactOnScroll
          activeKey={tab}
          onTabChange={(key) => setTab(key as TabKey)}
          tabs={visibleTabs.map((t) => ({
            key: t.key,
            label: t.label,
            count: t.key === "batches" ? detail.batches.length : t.key === "students" ? stats.student_count : null,
            panel,
          }))}
        />
      </div>

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
  if (rows.length === 0) {
    return (
      <section className={styles.empty}>
        <Users size={28} aria-hidden="true" />
        <p>{emptyMessage}</p>
      </section>
    );
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Students</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Roll number</th>
            {canViewStudentContacts && <th scope="col">Email</th>}
            <th scope="col">Programme</th>
            {canEditRoster && <th scope="col"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((st) => (
            <tr key={st.id}>
              <td><EntityLink href={`/dashboard/students/${st.id}`} permissions={STUDENT_PROFILE_PERMISSIONS} requiredPermissions={[PERM.students.view]}>{st.name}</EntityLink></td>
              <td>{st.roll_number ?? <span className={css.muted}>—</span>}</td>
              {canViewStudentContacts && <td>{st.email ?? <span className={css.muted}>—</span>}</td>}
              <td>{st.programme ?? <span className={css.muted}>—</span>}</td>
              {canEditRoster && (
                <td className={css.actionCell}>
                  {!schoolStudentIds.has(st.id) ? (
                    <span className={css.muted}>—</span>
                  ) : confirmRemoveId === st.id ? (
                    <>
                      <span className={css.muted} style={{ fontSize: "12px", marginRight: "4px" }}>
                        Remove from school?
                      </span>
                      <button type="button" onClick={() => onRemove(st.id)} disabled={removingId === st.id} className={css.danger}>
                        {removingId === st.id ? "Removing…" : "Yes"}
                      </button>
                      <button type="button" onClick={onCancelRemove} className={css.linkBtn}>
                        No
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => onConfirmRemove(st.id)} className={css.danger}>
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
