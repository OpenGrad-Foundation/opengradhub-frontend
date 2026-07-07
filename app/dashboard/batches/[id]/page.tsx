"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import {
  deleteBatch,
  addBatchMembers,
  removeBatchMember,
  addCourseToBatch,
  removeCourseFromBatch,
  addBundleToBatch,
  removeBundleFromBatch,
  addTestToBatch,
  updateBatchTest,
  removeTestFromBatch,
  getCourses,
  getBundles,
  getQuizzes,
  getStudentsList,
  fetchSchools,
  type BatchDetail,
  type BatchTestEntry,
  type Course,
  type Bundle,
  type Quiz,
  type StudentRosterItem,
  type SchoolOption,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { StateDistrictPicker } from "@/app/dashboard/_components/StateDistrictPicker";
import { normState } from "@/lib/geo";
import { useBatch } from "@/lib/queries/batches";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BatchDetailPage() {
  const { id: batchId } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { has } = usePermissions();
  const currentUrl = useCurrentUrl();

  const { data: batch, isLoading, error, refetch } = useBatch(batchId);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [addBundleOpen, setAddBundleOpen] = useState(false);
  const [addTestOpen, setAddTestOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const canEnrol = has(PERM.batches.enrol);
  const canAssign = has(PERM.batches.assign_content);
  const archived = batch?.status === "ARCHIVED";

  async function handleDelete() {
    if (!batch) return;
    const ok = window.confirm(
      `Delete batch "${batch.name}"? Only possible when no students are enrolled. This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteBatch(batchId);
      invalidate('batches');
      router.push("/dashboard/batches");
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to delete batch.");
      setDeleting(false);
    }
  }

  if (isLoading) return <Shell><LoadingCard /></Shell>;
  if (!has(PERM.batches.view)) {
    return (
      <Shell>
        <div style={glassCard}>
          <p style={labelSt}>Access Denied</p>
          <p style={{ ...headingSt, marginTop: "12px", fontSize: "18px" }}>
            You do not have permission to view batches.
          </p>
        </div>
      </Shell>
    );
  }
  if (!batch) {
    return (
      <Shell>
        <div style={glassCard}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>
            {error instanceof Error ? error.message : "Batch not found."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <BackLink fallback="/dashboard/batches" style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
        ← Back to Batches
      </BackLink>
      <div style={{ margin: "16px 0 28px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <p style={labelSt}>Batch</p>
          <h1 style={{ ...headingSt, fontSize: "26px", margin: "4px 0 0" }}>{batch.name}</h1>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "6px" }}>
            {batch.school_name ?? "Independent batch"}
            {batch.programme_type && ` · ${batch.programme_type}`}
            {(batch.starts_on || batch.ends_on) && ` · ${batch.starts_on ?? "…"} → ${batch.ends_on ?? "…"}`}
          </p>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
            {archived && (
              <span style={{ padding: "4px 10px", borderRadius: "100px", background: "rgba(3,72,82,0.08)", fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.6)" }}>
                ⏸ Archived — changes blocked, student access preserved
              </span>
            )}
            <Chip icon="👤" value={batch.members.length} label="student" />
            <Chip icon="📚" value={batch.courses.length} label="course" />
            <Chip icon="📦" value={batch.bundles.length} label="bundle" />
            <Chip icon="📝" value={batch.tests.length} label="quiz" plural="quizzes" />
          </div>
        </div>
        {has(PERM.batches.delete) && (
          <button onClick={() => void handleDelete()} disabled={deleting} style={{ ...dangerBtn, opacity: deleting ? 0.6 : 1 }}>
            {deleting ? "Deleting…" : "Delete Batch"}
          </button>
        )}
      </div>

      {globalError && <div style={{ ...errorBox, marginBottom: "20px" }}>{globalError}</div>}

      {/* ── Section 1: Members ───────────────────────────────── */}
      <Section
        title="Students in this Batch"
        subtitle="Students automatically receive every course, bundle, and quiz assigned to the batch."
        action={canEnrol && !archived ? (
          <button onClick={() => setAddMembersOpen(true)} style={primaryBtn}>+ Add Students</button>
        ) : undefined}
      >
        <MemberTable
          batchId={batchId}
          members={batch.members}
          canRemove={canEnrol && !archived}
          onChanged={() => { void refetch(); }}
          setGlobalError={setGlobalError}
        />
      </Section>

      {/* ── Section 2: Courses ───────────────────────────────── */}
      <Section
        title="Courses"
        subtitle="Assigned directly to the batch. Removing a course revokes it from members unless another batch, bundle, or direct enrolment still grants it."
        action={canAssign && !archived ? (
          <button onClick={() => setAddCourseOpen(true)} style={primaryBtn}>+ Add Course</button>
        ) : undefined}
      >
        {batch.courses.length === 0 ? (
          <EmptyHint text="No courses assigned yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {batch.courses.map((c) => (
              <ContentRow
                key={c.id}
                title={c.title}
                meta={`${c.programme_type} · ${c.status}`}
                onRemove={canAssign && !archived ? async () => {
                  if (!confirm(`Remove "${c.title}" from this batch? Members lose access unless granted elsewhere.`)) return;
                  try {
                    await removeCourseFromBatch(batchId, c.id);
                    invalidate('batches');
                    void refetch();
                  } catch (e) {
                    setGlobalError(e instanceof Error ? e.message : "Failed to remove course.");
                  }
                } : undefined}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── Section 3: Bundles ───────────────────────────────── */}
      <Section
        title="Bundles"
        subtitle="Members are enrolled in the bundle and all of its courses."
        action={canAssign && !archived ? (
          <button onClick={() => setAddBundleOpen(true)} style={primaryBtn}>+ Add Bundle</button>
        ) : undefined}
      >
        {batch.bundles.length === 0 ? (
          <EmptyHint text="No bundles assigned yet." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {batch.bundles.map((b) => (
              <ContentRow
                key={b.id}
                title={b.name}
                meta={`${b.course_count} course${b.course_count !== 1 ? "s" : ""}`}
                href={withFrom(`/dashboard/bundles/${b.id}`, currentUrl)}
                onRemove={canAssign && !archived ? async () => {
                  if (!confirm(`Remove bundle "${b.name}" from this batch? Members lose its courses unless granted elsewhere.`)) return;
                  try {
                    await removeBundleFromBatch(batchId, b.id);
                    invalidate('batches', 'bundles');
                    void refetch();
                  } catch (e) {
                    setGlobalError(e instanceof Error ? e.message : "Failed to remove bundle.");
                  }
                } : undefined}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── Section 4: Tests ─────────────────────────────────── */}
      <Section
        title="Quizzes"
        subtitle="Standalone global quizzes with an optional availability window per batch."
        action={canAssign && !archived ? (
          <button onClick={() => setAddTestOpen(true)} style={primaryBtn}>+ Add Quiz</button>
        ) : undefined}
      >
        <TestList
          batchId={batchId}
          tests={batch.tests}
          canManage={canAssign && !archived}
          onChanged={() => { void refetch(); }}
          setGlobalError={setGlobalError}
        />
      </Section>

      {/* ── Modals ───────────────────────────────────────────── */}
      {addMembersOpen && (
        <AddMembersModal
          batchId={batchId}
          existingMemberIds={batch.members.map((m) => m.id)}
          onClose={() => setAddMembersOpen(false)}
          onAdded={(msg) => { setAddMembersOpen(false); invalidate('batches', 'enrolment'); void refetch(); showToast(msg); }}
        />
      )}
      {addCourseOpen && (
        <AddCourseModal
          batchId={batchId}
          existingCourseIds={batch.courses.map((c) => c.id)}
          memberCount={batch.members.length}
          onClose={() => setAddCourseOpen(false)}
          onAdded={(msg) => { setAddCourseOpen(false); invalidate('batches', 'enrolment'); void refetch(); showToast(msg); }}
        />
      )}
      {addBundleOpen && (
        <AddBundleModal
          batchId={batchId}
          existingBundleIds={batch.bundles.map((b) => b.id)}
          memberCount={batch.members.length}
          onClose={() => setAddBundleOpen(false)}
          onAdded={(msg) => { setAddBundleOpen(false); invalidate('batches', 'bundles', 'enrolment'); void refetch(); showToast(msg); }}
        />
      )}
      {addTestOpen && (
        <AddTestModal
          batchId={batchId}
          existingTestIds={batch.tests.map((t) => t.id)}
          onClose={() => setAddTestOpen(false)}
          onAdded={(msg) => { setAddTestOpen(false); invalidate('batches'); void refetch(); showToast(msg); }}
        />
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #034852 0%, #006d6c 100%)",
          color: "#fff", padding: "12px 24px", borderRadius: "100px",
          fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
          boxShadow: "0 8px 24px rgba(3,72,82,0.3)", zIndex: 200,
          animation: "floatIn 0.3s ease forwards",
        }}>
          ✓ {toast}
        </div>
      )}
    </Shell>
  );
}

// ── Member table ──────────────────────────────────────────────────────────────

function MemberTable({
  batchId, members, canRemove, onChanged, setGlobalError,
}: {
  batchId: string;
  members: BatchDetail["members"];
  canRemove: boolean;
  onChanged: () => void;
  setGlobalError: (e: string | null) => void;
}) {
  const invalidate = useInvalidate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  // Drop any selected ids that no longer exist (e.g. after a removal refetch).
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(members.map((m) => m.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => { if (valid.has(id)) next.add(id); else changed = true; });
      return changed ? next : prev;
    });
  }, [members]);

  const allSelected = members.length > 0 && members.every((m) => selectedIds.has(m.id));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => (allSelected ? new Set() : new Set(members.map((m) => m.id))));
  }

  async function removeIds(ids: string[]) {
    setRemoving(true);
    setGlobalError(null);
    try {
      const results = await Promise.allSettled(ids.map((id) => removeBatchMember(batchId, id)));
      const failed = results.filter((r) => r.status === "rejected");
      invalidate('batches', 'enrolment');
      setSelectedIds(new Set());
      onChanged();
      if (failed.length) {
        setGlobalError(`${failed.length} of ${ids.length} student${ids.length !== 1 ? "s" : ""} could not be removed.`);
      }
    } finally {
      setRemoving(false);
    }
  }

  function handleRemoveSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Remove ${ids.length} student${ids.length !== 1 ? "s" : ""} from this batch? They lose batch-granted content unless another batch, bundle, or direct enrolment still covers it.`)) return;
    void removeIds(ids);
  }

  if (members.length === 0) {
    return <EmptyHint text="No students yet. Click “+ Add Students” to enrol the cohort." />;
  }
  return (
    <>
      {canRemove && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", minHeight: "32px" }}>
          <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)", fontWeight: 600 }}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${members.length} student${members.length !== 1 ? "s" : ""}`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleRemoveSelected}
              disabled={removing}
              style={{ ...dangerBtn, padding: "7px 14px", opacity: removing ? 0.6 : 1 }}
            >
              {removing ? "Removing…" : `Remove ${selectedIds.size} Selected`}
            </button>
          )}
        </div>
      )}
      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "rgba(32,147,121,0.04)", borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
              {canRemove && (
                <th style={{ padding: "11px 16px", textAlign: "left", width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all students"
                    style={{ accentColor: "#0abe62", width: "15px", height: "15px", cursor: "pointer" }}
                  />
                </th>
              )}
              {["Name", "Roll Number", "Email", "Joined"].map((h) => (
                <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const checked = selectedIds.has(m.id);
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(3,72,82,0.05)", background: checked ? "rgba(10,190,98,0.06)" : "transparent" }}>
                  {canRemove && (
                    <td style={{ ...tdSt, width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                        aria-label={`Select ${m.name}`}
                        style={{ accentColor: "#0abe62", width: "15px", height: "15px", cursor: "pointer" }}
                      />
                    </td>
                  )}
                  <td style={tdSt}><strong style={{ color: "#034852" }}>{m.name}</strong></td>
                  <td style={tdSt}>{m.roll_number ?? "—"}</td>
                  <td style={tdSt}>{m.email || "—"}</td>
                  <td style={tdSt}>{new Date(m.enrolled_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Test list with windows ────────────────────────────────────────────────────

function TestList({
  batchId, tests, canManage, onChanged, setGlobalError,
}: {
  batchId: string;
  tests: BatchTestEntry[];
  canManage: boolean;
  onChanged: () => void;
  setGlobalError: (e: string | null) => void;
}) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState<BatchTestEntry | null>(null);

  async function handleRemove(quizId: string, title: string) {
    if (!confirm(`Remove "${title}" from this batch? Existing attempts are not affected.`)) return;
    try {
      await removeTestFromBatch(batchId, quizId);
      invalidate('batches');
      onChanged();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Failed to remove quiz.");
    }
  }

  if (tests.length === 0) {
    return <EmptyHint text="No quizzes yet. Click “+ Add Quiz” to attach a published global quiz." />;
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {tests.map((t) => (
          <div key={t.id} style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 14px", borderRadius: "12px",
            background: "rgba(3,72,82,0.025)", border: "1px solid rgba(3,72,82,0.07)",
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>📝</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.title}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                {t.available_from || t.due_at
                  ? `${t.available_from ? `Opens ${new Date(t.available_from).toLocaleString()}` : "Open now"}${t.due_at ? ` · Due ${new Date(t.due_at).toLocaleString()}` : ""}`
                  : "No availability window"}
              </p>
            </div>
            <span style={{
              padding: "3px 9px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
              background: t.published ? "rgba(10,190,98,0.1)" : "rgba(255,222,0,0.2)",
              color: t.published ? "#0abe62" : "#956f00",
            }}>
              {t.published ? "Published" : "Draft"}
            </span>
            {canManage && (
              <>
                <button
                  onClick={() => setEditing(t)}
                  style={{ flexShrink: 0, padding: "5px 12px", borderRadius: "8px", border: "1.5px solid rgba(3,72,82,0.2)", background: "transparent", color: "#034852", fontWeight: 600, fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  Window
                </button>
                <button
                  onClick={() => void handleRemove(t.id, t.title)}
                  style={{ background: "none", border: "none", fontSize: "14px", color: "rgba(229,62,62,0.6)", cursor: "pointer", padding: "4px 6px", borderRadius: "8px", flexShrink: 0 }}
                  title="Remove from batch"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <TestWindowModal
          test={editing}
          onClose={() => setEditing(null)}
          onSave={async (availableFrom, dueAt) => {
            try {
              await updateBatchTest(batchId, editing.id, { available_from: availableFrom, due_at: dueAt });
              invalidate('batches');
              setEditing(null);
              onChanged();
            } catch (e) {
              setGlobalError(e instanceof Error ? e.message : "Failed to update window.");
            }
          }}
        />
      )}
    </>
  );
}

function TestWindowModal({
  test, onClose, onSave,
}: {
  test: BatchTestEntry;
  onClose: () => void;
  onSave: (availableFrom: string | null, dueAt: string | null) => Promise<void>;
}) {
  const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
  const [from, setFrom] = useState(toLocal(test.available_from));
  const [due, setDue] = useState(toLocal(test.due_at));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (from && due && from >= due) { setErr("Opens-at must be before due date."); return; }
    setSaving(true);
    setErr(null);
    await onSave(from ? new Date(from).toISOString() : null, due ? new Date(due).toISOString() : null);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title={`Availability — ${test.title}`}>
      <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>Opens at (blank = immediately)</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>Due at (blank = no deadline)</label>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={inputSt} />
        </div>
        {err && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{err}</p>}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} style={ghostBtnSm}>Cancel</button>
        <button onClick={() => void save()} disabled={saving} style={{ ...primaryBtnSm, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Window"}
        </button>
      </div>
    </Modal>
  );
}

// ── Add Members Modal (multi-select) ──────────────────────────────────────────

function AddMembersModal({
  batchId, existingMemberIds, onClose, onAdded,
}: {
  batchId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStudentsList()
      .then((data) => setStudents(data.filter((u) => !existingMemberIds.includes(u.id))))
      .catch((e) => { setError(e instanceof Error ? e.message : "Failed to load students."); setStudents([]); })
      .finally(() => setLoading(false));
  }, [existingMemberIds]);

  useEffect(() => {
    let cancelled = false;
    fetchSchools()
      .then((rows) => { if (!cancelled) setSchools(rows); })
      .catch(() => { if (!cancelled) setSchools([]); });
    return () => { cancelled = true; };
  }, []);

  const INDEPENDENT = "__INDEPENDENT__"; // students with no school

  // School options follow the state/district filter so the list stays scoped.
  const schoolOptions = schools.filter((s) => {
    if (filterState && normState(s.state) !== filterState) return false;
    if (filterDistrict && (s.district ?? "") !== filterDistrict) return false;
    return true;
  });

  // Selecting a state/district can invalidate the chosen school — clear it.
  function changeState(v: string) { setFilterState(v); setFilterDistrict(""); setFilterSchoolId(""); }
  function changeDistrict(v: string) { setFilterDistrict(v); setFilterSchoolId(""); }

  const filtered = students.filter((u) => {
    const q = search.toLowerCase();
    if (q && !((u.name ?? "").toLowerCase().includes(q) || (u.roll_number ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q))) return false;
    if (filterSchoolId === INDEPENDENT) { if (u.school_id) return false; }
    else if (filterSchoolId && u.school_id !== filterSchoolId) return false;
    if (filterState && normState(u.state) !== filterState) return false;
    if (filterDistrict && (u.district ?? "") !== filterDistrict) return false;
    return true;
  });

  // Select-all operates on the current filtered set: checked when every
  // filtered student is selected (and there is at least one).
  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selectedIds.has(u.id));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError(null);
  }

  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((u) => next.delete(u.id));
      else filtered.forEach((u) => next.add(u.id));
      return next;
    });
    setError(null);
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addBatchMembers(batchId, Array.from(selectedIds));
      onAdded(`${result.enrolled} student${result.enrolled !== 1 ? "s" : ""} added to batch.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add students.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={!submitting ? onClose : undefined} title="Add Students to Batch">
      <input
        autoFocus
        type="text"
        placeholder="Search by name, roll number, or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputSt, marginBottom: "10px" }}
      />
      <div style={{ marginBottom: "10px" }}>
        <StateDistrictPicker
          state={filterState}
          district={filterDistrict}
          onStateChange={changeState}
          onDistrictChange={changeDistrict}
          blankStateLabel="All states"
          inputStyle={inputSt}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        <select
          value={filterSchoolId}
          onChange={(e) => setFilterSchoolId(e.target.value)}
          aria-label="Filter by school"
          style={inputSt}
        >
          <option value="">All schools</option>
          <option value={INDEPENDENT}>Independent (no school)</option>
          {schoolOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}{s.district ? ` · ${s.district}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: filtered.length ? "pointer" : "default", fontSize: "12px", fontWeight: 600, color: filtered.length ? "#034852" : "rgba(3,72,82,0.4)" }}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={toggleAllFiltered}
            disabled={filtered.length === 0}
            style={{ accentColor: "#0abe62", width: "14px", height: "14px" }}
          />
          Select all{filtered.length ? ` (${filtered.length})` : ""}
        </label>
        <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)" }}>{selectedIds.size} selected</span>
      </div>
      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "12px", marginBottom: "12px" }}>
        {loading ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading students…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
            {search || filterState || filterDistrict ? "No matching students." : "No students available."}
          </p>
        ) : filtered.map((u) => {
          const checked = selectedIds.has(u.id);
          return (
            <label
              key={u.id}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", cursor: "pointer",
                borderBottom: "1px solid rgba(3,72,82,0.05)",
                background: checked ? "rgba(10,190,98,0.07)" : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(u.id)}
                style={{ accentColor: "#0abe62", width: "14px", height: "14px", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#034852" }}>{u.name}</span>
                <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                  {u.roll_number ?? u.email ?? "—"} · {u.programme_type ?? "—"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "10px" }}>{error}</p>}
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={onClose} style={ghostBtnSm} disabled={submitting}>Cancel</button>
        <button
          onClick={() => void handleAdd()}
          disabled={selectedIds.size === 0 || submitting}
          style={{ ...primaryBtnSm, opacity: (selectedIds.size === 0 || submitting) ? 0.45 : 1 }}
        >
          {submitting ? "Adding…" : `Add ${selectedIds.size || ""} Student${selectedIds.size !== 1 ? "s" : ""}`}
        </button>
      </div>
    </Modal>
  );
}

// ── Add Course Modal ──────────────────────────────────────────────────────────

function AddCourseModal({
  batchId, existingCourseIds, memberCount, onClose, onAdded,
}: {
  batchId: string;
  existingCourseIds: string[];
  memberCount: number;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Course | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCourses(undefined, undefined, undefined, true)
      .then((data) => setCourses(data.filter((c) => c.status === "ACTIVE" && !existingCourseIds.includes(c.id))))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [existingCourseIds]);

  const filtered = courses.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addCourseToBatch(batchId, selected.id);
      onAdded(`"${selected.title}" assigned — ${result.students_enrolled} of ${memberCount} member${memberCount !== 1 ? "s" : ""} newly enrolled.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add course.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Course to Batch">
      <PickerList
        loading={loading}
        items={filtered.map((c) => ({ id: c.id, title: c.title, meta: `${c.programme_type} · ${c.lesson_count} lesson${c.lesson_count !== 1 ? "s" : ""}` }))}
        selectedId={selected?.id ?? null}
        onSelect={(id) => { setSelected(courses.find((c) => c.id === id) ?? null); setError(null); }}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search active courses…"
        emptyText="No active courses available."
      />
      {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
      <ModalActions onClose={onClose} onConfirm={() => void handleAdd()} disabled={!selected || submitting} label={submitting ? "Adding…" : "Add Course"} />
    </Modal>
  );
}

// ── Add Bundle Modal ──────────────────────────────────────────────────────────

function AddBundleModal({
  batchId, existingBundleIds, memberCount, onClose, onAdded,
}: {
  batchId: string;
  existingBundleIds: string[];
  memberCount: number;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBundles()
      .then((data) => setBundles(data.filter((b) => !existingBundleIds.includes(b.id))))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false));
  }, [existingBundleIds]);

  const filtered = bundles.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addBundleToBatch(batchId, selected.id);
      onAdded(`Bundle "${selected.name}" assigned — ${result.students_enrolled} of ${memberCount} member${memberCount !== 1 ? "s" : ""} newly enrolled.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add bundle.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Bundle to Batch">
      <PickerList
        loading={loading}
        items={filtered.map((b) => ({ id: b.id, title: b.name, meta: `${b.course_count} course${b.course_count !== 1 ? "s" : ""}` }))}
        selectedId={selected?.id ?? null}
        onSelect={(id) => { setSelected(bundles.find((b) => b.id === id) ?? null); setError(null); }}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search bundles…"
        emptyText="No bundles available."
      />
      {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
      <ModalActions onClose={onClose} onConfirm={() => void handleAdd()} disabled={!selected || submitting} label={submitting ? "Adding…" : "Add Bundle"} />
    </Modal>
  );
}

// ── Add Test Modal ────────────────────────────────────────────────────────────

function AddTestModal({
  batchId, existingTestIds, onClose, onAdded,
}: {
  batchId: string;
  existingTestIds: string[];
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [quizzes, setQuizzes] = useState<Omit<Quiz, "questions">[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Omit<Quiz, "questions"> | null>(null);
  const [from, setFrom] = useState("");
  const [due, setDue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuizzes({ quiz_type: "GLOBAL_TEST" })
      .then((data) => setQuizzes(data.filter((q) => q.published && !existingTestIds.includes(q.id))))
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, [existingTestIds]);

  const filtered = quizzes.filter((q) => q.title.toLowerCase().includes(search.toLowerCase()));

  async function handleAdd() {
    if (!selected) return;
    if (from && due && from >= due) { setError("Opens-at must be before due date."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await addTestToBatch(batchId, selected.id, {
        available_from: from ? new Date(from).toISOString() : null,
        due_at: due ? new Date(due).toISOString() : null,
      });
      onAdded(`"${selected.title}" assigned to batch.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add Quiz to Batch">
      <PickerList
        loading={loading}
        items={filtered.map((q) => ({
          id: q.id, title: q.title,
          meta: `${q.duration_minutes != null ? `${q.duration_minutes} min` : "No time limit"}${q.max_attempts != null && q.max_attempts > 0 ? ` · max ${q.max_attempts} attempt${q.max_attempts !== 1 ? "s" : ""}` : ""}`,
        }))}
        selectedId={selected?.id ?? null}
        onSelect={(id) => { setSelected(quizzes.find((q) => q.id === id) ?? null); setError(null); }}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search published global quizzes…"
        emptyText="No published global quizzes available."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
        <div style={{ minWidth: 0 }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>Opens at (optional)</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={inputSt} />
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={{ display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>Due at (optional)</label>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={inputSt} />
        </div>
      </div>
      {error && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
      <ModalActions onClose={onClose} onConfirm={() => void handleAdd()} disabled={!selected || submitting} label={submitting ? "Adding…" : "Add Quiz"} />
    </Modal>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function PickerList({
  loading, items, selectedId, onSelect, search, onSearch, searchPlaceholder, emptyText,
}: {
  loading: boolean;
  items: { id: string; title: string; meta: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
  searchPlaceholder: string;
  emptyText: string;
}) {
  return (
    <>
      <input
        autoFocus
        type="text"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{ ...inputSt, marginBottom: "12px" }}
      />
      <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "12px", marginBottom: "12px" }}>
        {loading ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
            {search ? "No matches." : emptyText}
          </p>
        ) : items.map((item) => {
          const active = selectedId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                padding: "12px 16px", cursor: "pointer",
                background: active ? "rgba(10,190,98,0.07)" : "transparent",
                borderLeft: `3px solid ${active ? "#0abe62" : "transparent"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{item.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>{item.meta}</p>
              </div>
              {active && <span style={{ color: "#0abe62", fontSize: "16px" }}>✓</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ModalActions({ onClose, onConfirm, disabled, label }: {
  onClose: () => void; onConfirm: () => void; disabled: boolean; label: string;
}) {
  return (
    <div style={{ display: "flex", gap: "10px" }}>
      <button onClick={onClose} style={ghostBtnSm}>Cancel</button>
      <button onClick={onConfirm} disabled={disabled} style={{ ...primaryBtnSm, opacity: disabled ? 0.45 : 1 }}>
        {label}
      </button>
    </div>
  );
}

function ContentRow({ title, meta, href, onRemove }: {
  title: string; meta: string; href?: string; onRemove?: () => Promise<void> | void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "12px 14px", borderRadius: "12px",
      background: "rgba(3,72,82,0.025)", border: "1px solid rgba(3,72,82,0.07)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {href ? (
          <Link href={href} style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", textDecoration: "none" }}>
            {title}
          </Link>
        ) : (
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </p>
        )}
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>{meta}</p>
      </div>
      {onRemove && (
        <button
          onClick={() => void onRemove()}
          style={{ background: "none", border: "none", fontSize: "14px", color: "rgba(229,62,62,0.6)", cursor: "pointer", padding: "4px 6px", borderRadius: "8px", flexShrink: 0 }}
          title="Remove from batch"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.45)", padding: "16px 0" }}>{text}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: "800px", margin: "0 auto" }}>{children}</div>;
}

function Section({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ ...glassCard, marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: subtitle ? "4px" : "20px" }}>
        <h2 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h2>
        {action}
      </div>
      {subtitle && (
        <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", margin: "0 0 18px" }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,20,30,0.3)", backdropFilter: "blur(4px)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(500px, 92vw)", maxHeight: "90vh", zIndex: 51 }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "24px", padding: "32px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
          border: "1px solid rgba(255,255,255,0.3)",
          opacity: 0, transform: "translateY(12px)",
          animation: "floatIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
          maxHeight: "90vh", overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h3>
            {onClose && <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.45)", cursor: "pointer", padding: "4px 8px" }}>✕</button>}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function Chip({ icon, value, label, plural }: { icon: string; value: number; label: string; plural?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "4px 10px", borderRadius: "100px",
      background: "rgba(3,72,82,0.06)", fontSize: "12px",
      fontWeight: 600, color: "#034852",
    }}>
      {icon} {value} {value === 1 ? label : (plural ?? `${label}s`)}
    </span>
  );
}

function LoadingCard() {
  return (
    <div style={{ ...glassCard, textAlign: "center" }}>
      <p style={labelSt}>Loading</p>
      <p style={{ ...headingSt, marginTop: "12px", fontSize: "18px" }}>Fetching batch…</p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "28px 32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const labelSt: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};

const headingSt: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0,
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 18px", border: "none", borderRadius: "10px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
  boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
};

const dangerBtn: React.CSSProperties = {
  padding: "9px 18px", borderRadius: "10px",
  border: "1px solid rgba(229,62,62,0.35)",
  background: "rgba(229,62,62,0.06)",
  color: "#c53030", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap",
};

const primaryBtnSm: React.CSSProperties = {
  flex: 2, padding: "11px 18px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "14px", cursor: "pointer",
};

const ghostBtnSm: React.CSSProperties = {
  flex: 1, padding: "11px 14px",
  border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "12px",
  background: "#ffffff", color: "#034852",
  fontFamily: "var(--font-heading)", fontWeight: 600,
  fontSize: "14px", cursor: "pointer", textAlign: "center",
};

const inputSt: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(3,72,82,0.03)",
  border: "1px solid rgba(3,72,82,0.12)",
  borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
};

const tdSt: React.CSSProperties = {
  padding: "11px 16px", textAlign: "left", color: "rgba(3,72,82,0.75)", fontSize: "13px",
};

const errorBox: React.CSSProperties = {
  padding: "10px 14px", borderRadius: "10px",
  background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)",
  fontSize: "13px", color: "#c53030", fontWeight: 500,
};
