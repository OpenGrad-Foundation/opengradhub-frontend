"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, CalendarDays, Check, ClipboardList, GraduationCap, Package, Pause, Pencil, Plus, Radio, School, Users, X } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { IN_CHARGE, IN_CHARGE_LOWER } from "@/lib/labels";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import {
  deleteBatch,
  addBatchMembers,
  removeBatchMember,
  setBatchMembersFellow,
  getFellows,
  type FellowOption,
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
  getStudentRoster,
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
import { Tabs, type TabDef } from "@/app/dashboard/_components/Tabs";
import { BatchForm } from "../BatchForm";
import workspace from "@/components/dashboard/workspace.module.css";
import catalogue from "@/app/dashboard/_components/catalogue.module.css";
import local from "../batches.module.css";

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
  const canEdit = has(PERM.batches.edit);
  const canDelete = has(PERM.batches.delete);
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

  function openSettings() {
    // Same URL-driven tab switch <Tabs> does, so other params (from=) survive.
    const next = new URLSearchParams(window.location.search);
    next.set("tab", "settings");
    router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
  }
  if (!has(PERM.batches.view)) {
    return (
      <Shell>
        <div style={glassCard}>
          <p style={{ ...headingSt, fontSize: "18px" }}>
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
          <p style={{ color: "#b83232", fontWeight: 600, margin: 0 }}>
            {error instanceof Error ? error.message : "Batch not found."}
          </p>
        </div>
      </Shell>
    );
  }

  // Panels are declared up front so the conditional Settings tab stays typed;
  // <Tabs> renders only the active one.
  const tabs: TabDef[] = [
    {
      key: "students",
      label: "Students",
      count: batch.members.length,
      panel: (
        <Section
          title="Students in this Batch"
          action={canEnrol && !archived ? (
            <button onClick={() => setAddMembersOpen(true)} style={primaryBtn}><Plus size={18} aria-hidden="true" />Add Students</button>
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
      ),
    },
    {
      key: "courses",
      label: "Courses",
      count: batch.courses.length,
      panel: (
        <Section
          title="Courses"
          action={canAssign && !archived ? (
            <button onClick={() => setAddCourseOpen(true)} style={primaryBtn}><Plus size={18} aria-hidden="true" />Add Course</button>
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
                  badge={!c.is_direct && c.via_bundles.length > 0
                    ? `via ${c.via_bundles.join(", ")}`
                    : undefined}
                  // Bundle-derived courses are detached by removing the bundle,
                  // so they carry no per-course remove control.
                  onRemove={canAssign && !archived && c.is_direct ? async () => {
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
      ),
    },
    {
      key: "bundles",
      label: "Bundles",
      count: batch.bundles.length,
      panel: (
        <Section
          title="Bundles"
          action={canAssign && !archived ? (
            <button onClick={() => setAddBundleOpen(true)} style={primaryBtn}><Plus size={18} aria-hidden="true" />Add Bundle</button>
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
      ),
    },
    {
      key: "quizzes",
      label: "Quizzes",
      count: batch.tests.length,
      panel: (
        <Section
          title="Quizzes"
          action={canAssign && !archived ? (
            <button onClick={() => setAddTestOpen(true)} style={primaryBtn}><Plus size={18} aria-hidden="true" />Add Quiz</button>
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
      ),
    },
  ];

  if (canEdit) {
    tabs.push({
      key: "settings",
      label: "Settings",
      panel: (
        <>
          <Section title="Batch Details">
            {/* Remounts when the saved record changes so the fields never show
                a stale draft after a refetch. */}
            <BatchForm
              key={[batch.id, batch.name, batch.status, batch.school_id ?? "", batch.programme_type ?? "", batch.starts_on ?? "", batch.ends_on ?? ""].join("|")}
              mode="edit"
              batch={batch}
              submitLabel="Save settings"
              onSaved={() => { void refetch(); showToast("Batch updated."); }}
            />
          </Section>
          {canDelete && (
            <Section title="Danger Zone">
              <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                Deleting a batch is permanent. It only works while no students are enrolled &mdash; clear the cohort from the Students tab first.
              </p>
              <button onClick={() => void handleDelete()} disabled={deleting} style={{ ...dangerBtn, opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting…" : "Delete Batch"}
              </button>
            </Section>
          )}
        </>
      ),
    });
  }

  return (
    <Shell>
      <div className={local.header}>
        <div className={local.toolbar}>
          <BackLink fallback="/dashboard/batches" className={catalogue.secondary}>
            <ArrowLeft size={16} aria-hidden="true" /><span><span className="hidden sm:inline">Back to </span>Batches</span>
          </BackLink>
          {canEdit && (
            <div className={local.headerActions}>
              <button type="button" onClick={openSettings} className={catalogue.secondary}>
                <Pencil size={16} aria-hidden="true" />Edit batch
              </button>
            </div>
          )}
        </div>
        <div className={local.identity}>
          <h2>{batch.name}</h2>
          <div className={local.meta}>
            <span className={local.status} data-active={batch.status === "ACTIVE"}>
              {archived && <Pause size={14} aria-hidden="true" />}
              {archived ? "Archived — changes blocked, student access preserved" : batch.status === "ACTIVE" ? "Active" : batch.status}
            </span>
            <span><Radio size={14} aria-hidden="true" />{batch.delivery_mode === "ONLINE" ? "Online attendance" : "School-based attendance"}</span>
            <span><School size={14} aria-hidden="true" />{batch.school_name ?? "Independent batch"}</span>
            {batch.programme_type && <span><GraduationCap size={14} aria-hidden="true" />{batch.programme_type}</span>}
            {(batch.starts_on || batch.ends_on) && <span><CalendarDays size={14} aria-hidden="true" />{batch.starts_on ?? "…"} → {batch.ends_on ?? "…"}</span>}
            <Chip icon={<Users size={14} aria-hidden="true" />} value={batch.members.length} label="student" />
            <Chip icon={<BookOpen size={14} aria-hidden="true" />} value={batch.courses.length} label="course" />
            <Chip icon={<Package size={14} aria-hidden="true" />} value={batch.bundles.length} label="bundle" />
            <Chip icon={<ClipboardList size={14} aria-hidden="true" />} value={batch.tests.length} label="quiz" plural="quizzes" />
          </div>
        </div>
      </div>

      {globalError && <div role="alert" style={{ ...errorBox, marginBottom: "20px" }}>{globalError}</div>}

      <div className={`${workspace.stickyTabs} ${local.tabs}`}>
        <Tabs tabs={tabs} ariaLabel="Batch sections" />
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      {addMembersOpen && (
        <AddMembersModal
          batchId={batchId}
          onClose={() => setAddMembersOpen(false)}
          onAdded={(msg) => { setAddMembersOpen(false); invalidate('batches', 'enrolment'); void refetch(); showToast(msg); }}
        />
      )}
      {addCourseOpen && (
        <AddCourseModal
          batchId={batchId}
          existingCourseIds={batch.courses.filter((c) => c.is_direct).map((c) => c.id)}
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
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "var(--dark-teal)",
          color: "#fff", padding: "12px 20px", borderRadius: "12px",
          fontWeight: 600, fontSize: "14px",
          zIndex: 200,
          animation: "floatIn 0.3s ease forwards",
        }}>
          <Check size={16} aria-hidden="true" />{toast}
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
  const [fellows, setFellows] = useState<FellowOption[]>([]);
  const [fellowChoice, setFellowChoice] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!canRemove) return;
    getFellows().then(setFellows).catch(() => setFellows([]));
  }, [canRemove]);

  async function assignFellow(clear: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!clear && !fellowChoice) return;
    setAssigning(true);
    setGlobalError(null);
    try {
      await setBatchMembersFellow(batchId, ids, clear ? null : fellowChoice);
      invalidate('batches', 'enrolment');
      setSelectedIds(new Set());
      onChanged();
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : `Failed to set batch ${IN_CHARGE_LOWER}.`);
    } finally {
      setAssigning(false);
    }
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", minHeight: "44px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: "var(--color-text-muted)", fontWeight: 500 }}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${members.length} student${members.length !== 1 ? "s" : ""}`}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleRemoveSelected}
              disabled={removing}
              style={{ ...dangerBtn, opacity: removing ? 0.6 : 1 }}
            >
              {removing ? "Removing…" : `Remove ${selectedIds.size} Selected`}
            </button>
          )}
          {selectedIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", flexWrap: "wrap" }}>
              <select
                value={fellowChoice}
                onChange={(e) => setFellowChoice(e.target.value)}
                disabled={assigning}
                aria-label={`${IN_CHARGE} to assign`}
                style={{ ...inputSt, width: "auto" }}
              >
                <option value="">Choose {IN_CHARGE_LOWER}…</option>
                {fellows.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button
                onClick={() => void assignFellow(false)}
                disabled={assigning || !fellowChoice}
                style={{ ...primaryBtn, opacity: assigning || !fellowChoice ? 0.6 : 1 }}
              >
                {assigning ? "Assigning…" : `Assign to ${selectedIds.size}`}
              </button>
              <button
                onClick={() => void assignFellow(true)}
                disabled={assigning}
                style={{ ...ghostBtnSm, flex: "none", opacity: assigning ? 0.6 : 1 }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid var(--color-border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#eef5f3" }}>
              {canRemove && (
                <th scope="col" style={{ ...thSt, width: "40px" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all students"
                    style={{ accentColor: "var(--teal)", width: "15px", height: "15px", cursor: "pointer" }}
                  />
                </th>
              )}
              {["Name", "Roll Number", "Email", IN_CHARGE, "Joined"].map((h) => (
                <th key={h} scope="col" style={thSt}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const checked = selectedIds.has(m.id);
              return (
                <tr key={m.id} style={{ borderTop: "1px solid var(--color-border)", background: checked ? "var(--color-success-surface)" : "transparent" }}>
                  {canRemove && (
                    <td style={{ ...tdSt, width: "40px" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m.id)}
                        aria-label={`Select ${m.name}`}
                        style={{ accentColor: "var(--teal)", width: "15px", height: "15px", cursor: "pointer" }}
                      />
                    </td>
                  )}
                  <td style={tdSt}><strong style={{ color: "var(--color-text)", fontWeight: 600 }}>{m.name}</strong></td>
                  <td style={tdSt}>{m.roll_number ?? "—"}</td>
                  <td style={tdSt}>{m.email || "—"}</td>
                  <td style={tdSt}>{m.fellow_name ?? "—"}</td>
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
            background: "var(--color-surface)", border: "1px solid var(--color-border)",
          }}>
            <ClipboardList size={18} aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text-muted)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.title}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>
                {t.available_from || t.due_at
                  ? `${t.available_from ? `Opens ${new Date(t.available_from).toLocaleString()}` : "Open now"}${t.due_at ? ` · Due ${new Date(t.due_at).toLocaleString()}` : ""}`
                  : "No availability window"}
              </p>
            </div>
            <span style={{
              padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, flexShrink: 0,
              background: t.published ? "var(--color-success-surface)" : "rgba(255,222,0,0.2)",
              color: t.published ? "#08784a" : "#7a5a00",
            }}>
              {t.published ? "Published" : "Draft"}
            </span>
            {canManage && (
              <>
                <button
                  onClick={() => setEditing(t)}
                  style={{ ...ghostBtnSm, flex: "none" }}
                >
                  Window
                </button>
                <button
                  onClick={() => void handleRemove(t.id, t.title)}
                  style={removeBtn}
                  aria-label="Remove from batch"
                  title="Remove from batch"
                >
                  <X size={18} aria-hidden="true" />
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
          <label style={fieldLabelSt}>Opens at (blank = immediately)</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={inputSt} />
        </div>
        <div>
          <label style={fieldLabelSt}>Due at (blank = no deadline)</label>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={inputSt} />
        </div>
        {err && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, margin: 0 }}>{err}</p>}
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

const ROSTER_PAGE_SIZE = 100;
/** Mirrors ADD_MEMBERS_MAX in the backend's batches service. */
const ADD_MEMBERS_CHUNK = 500;
const INDEPENDENT = "__INDEPENDENT__"; // students with no school

function AddMembersModal({
  batchId, onClose, onAdded,
}: {
  batchId: string;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [scopeLimited, setScopeLimited] = useState(false);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterSchoolId, setFilterSchoolId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Discards responses to superseded queries — filters change faster than the network. */
  const requestSeq = useRef(0);

  // Typing must not fire a request per keystroke, and the server is the only
  // thing that can see past the current page.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => ({
    search:           debouncedSearch || undefined,
    state:            filterState || undefined,
    district:         filterDistrict || undefined,
    school_id:        filterSchoolId === INDEPENDENT ? "none" : (filterSchoolId || undefined),
    // Members are excluded server-side so "showing N of M" and "Select all (N)"
    // count the same set. Subtracting them in the browser made the two disagree.
    exclude_batch_id: batchId,
    limit:            ROSTER_PAGE_SIZE,
  }), [debouncedSearch, filterState, filterDistrict, filterSchoolId, batchId]);

  // Any filter change is a NEW result set: reset to the first page and replace.
  useEffect(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    getStudentRoster({ ...query, offset: 0 })
      .then((page) => {
        if (seq !== requestSeq.current) return;   // a newer query already answered
        setStudents(page.items);
        setRosterTotal(page.total);
        setHasMore(page.has_more);
        setScopeLimited(page.scope_limited);
        setError(null);
      })
      .catch((e) => {
        if (seq !== requestSeq.current) return;
        setError(e instanceof Error ? e.message : "Failed to load students.");
        setStudents([]);
        setRosterTotal(0);
        setHasMore(false);
      })
      .finally(() => { if (seq === requestSeq.current) setLoading(false); });
  }, [query]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    try {
      const page = await getStudentRoster({ ...query, offset: students.length });
      if (seq !== requestSeq.current) return;     // filters moved while in flight
      setStudents((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...page.items.filter((u) => !seen.has(u.id))];
      });
      setRosterTotal(page.total);
      setHasMore(page.has_more);
    } catch (e) {
      if (seq === requestSeq.current) {
        setError(e instanceof Error ? e.message : "Failed to load more students.");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchSchools()
      .then((rows) => { if (!cancelled) setSchools(rows); })
      .catch(() => { if (!cancelled) setSchools([]); });
    return () => { cancelled = true; };
  }, []);

  // School options follow the state/district filter so the list stays scoped.
  const schoolOptions = schools.filter((s) => {
    if (filterState && normState(s.state) !== filterState) return false;
    if (filterDistrict && (s.district ?? "") !== filterDistrict) return false;
    return true;
  });

  // Selecting a state/district can invalidate the chosen school — clear it.
  function changeState(v: string) { setFilterState(v); setFilterDistrict(""); setFilterSchoolId(""); }
  function changeDistrict(v: string) { setFilterDistrict(v); setFilterSchoolId(""); }

  // No client-side filtering: `students` IS the server's answer to the current
  // filters. Filtering again here is what made the picker unable to reach
  // anyone outside the first page it happened to have loaded.
  const anyFilterActive = Boolean(debouncedSearch || filterState || filterDistrict || filterSchoolId);

  // Select-all operates on what is loaded, and says so — the alternative was
  // disabling it whenever more rows existed, which made large cohorts unusable.
  const allLoadedSelected = students.length > 0 && students.every((u) => selectedIds.has(u.id));

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError(null);
  }

  function toggleAllLoaded() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allLoadedSelected) students.forEach((u) => next.delete(u.id));
      else students.forEach((u) => next.add(u.id));
      return next;
    });
    setError(null);
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    const ids = Array.from(selectedIds);
    let added = 0;
    try {
      // The server refuses more than ADD_MEMBERS_CHUNK ids per request, and
      // "Select all loaded" can exceed that after a few Load mores — so send it
      // in chunks rather than letting the advertised workflow 400.
      for (let i = 0; i < ids.length; i += ADD_MEMBERS_CHUNK) {
        const result = await addBatchMembers(batchId, ids.slice(i, i + ADD_MEMBERS_CHUNK));
        added += result.enrolled;
      }
      onAdded(`${added} student${added !== 1 ? "s" : ""} added to batch.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add students.";
      if (added > 0) {
        // Earlier chunks are already committed. Closing through onAdded is what
        // refetches the batch — leaving the modal open on an error would show a
        // roster that no longer matches the database, and the picker excludes
        // members server-side so its own list would be stale too.
        onAdded(`${added} student${added !== 1 ? "s" : ""} added, then failed: ${msg}`);
        return;
      }
      setError(msg);
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
      {hasMore && (
        <p style={{ marginBottom: "10px", padding: "10px 12px", borderRadius: "8px", background: "#eef5f3", border: "1px solid var(--color-border)", fontSize: "13px", fontWeight: 500, color: "var(--color-text)", lineHeight: 1.5 }}>
          Showing {students.length} of {rosterTotal} matching students. Search
          and the filters run on the server, so narrowing them reaches every
          student — or load the rest below.
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: students.length ? "pointer" : "default", fontSize: "12px", fontWeight: 600, color: students.length ? "var(--color-text)" : "var(--color-text-muted)", minHeight: "44px" }}>
          <input
            type="checkbox"
            checked={allLoadedSelected}
            onChange={toggleAllLoaded}
            disabled={students.length === 0}
            style={{ accentColor: "var(--teal)", width: "14px", height: "14px" }}
          />
          Select all{students.length ? ` loaded (${students.length})` : ""}
        </label>
        <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{selectedIds.size} selected</span>
      </div>
      <div style={{ maxHeight: "280px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "12px", marginBottom: "12px" }}>
        {loading ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Loading students…</p>
        ) : students.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
            {anyFilterActive
              ? "No matching students."
              : scopeLimited
                // An empty roster and an out-of-scope roster look identical to a
                // user, and they call for completely different next steps.
                ? "No students in your scope. This school may not be attached to a programme you belong to — ask an admin to attach it, or to give you access."
                : "No students available."}
          </p>
        ) : students.map((u) => {
          const checked = selectedIds.has(u.id);
          return (
            <label
              key={u.id}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", cursor: "pointer",
                borderBottom: "1px solid var(--color-border)",
                background: checked ? "var(--color-success-surface)" : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(u.id)}
                style={{ accentColor: "var(--teal)", width: "14px", height: "14px", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{u.name}</span>
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {u.roll_number ?? u.email ?? "—"} · {u.programme_type ?? "—"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {hasMore && !loading && (
        <button
          onClick={() => void loadMore()}
          disabled={loadingMore}
          style={{ ...ghostBtnSm, width: "100%", marginBottom: "10px", opacity: loadingMore ? 0.5 : 1 }}
        >
          {loadingMore ? "Loading…" : `Load more (${rosterTotal - students.length} left)`}
        </button>
      )}
      {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "10px" }}>{error}</p>}
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
      {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
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
      {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
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
          <label style={fieldLabelSt}>Opens at (optional)</label>
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={inputSt} />
        </div>
        <div style={{ minWidth: 0 }}>
          <label style={fieldLabelSt}>Due at (optional)</label>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={inputSt} />
        </div>
      </div>
      {error && <p style={{ fontSize: "13px", color: "#b83232", fontWeight: 600, marginBottom: "12px" }}>{error}</p>}
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
      <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: "12px", marginBottom: "12px" }}>
        {loading ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ padding: "20px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
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
                background: active ? "var(--color-success-surface)" : "transparent",
                borderLeft: `3px solid ${active ? "var(--teal)" : "transparent"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{item.title}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>{item.meta}</p>
              </div>
              {active && <Check size={18} aria-hidden="true" style={{ color: "#08784a", flexShrink: 0 }} />}
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

function ContentRow({ title, meta, href, badge, onRemove }: {
  title: string; meta: string; href?: string; badge?: string;
  onRemove?: () => Promise<void> | void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "12px 14px", borderRadius: "12px",
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {href ? (
          <Link href={href} style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", textDecoration: "none" }}>
            {title}
          </Link>
        ) : (
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </p>
        )}
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--color-text-muted)" }}>{meta}</p>
      </div>
      {badge && (
        <span style={{
          flexShrink: 0, padding: "3px 8px", borderRadius: "6px",
          background: "#eef5f3", color: "var(--color-text-muted)",
          fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap",
        }}>
          {badge}
        </span>
      )}
      {onRemove && (
        <button
          onClick={() => void onRemove()}
          style={removeBtn}
                  aria-label="Remove from batch"
          title="Remove from batch"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p style={{ fontSize: "14px", color: "var(--color-text-muted)", padding: "16px 0", margin: 0 }}>{text}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className={`${workspace.workspace} ${local.page}`}>{children}</div>;
}

function Section({ title, action, children }: {
  title: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ ...glassCard, marginBottom: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "20px" }}>
        <h2 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose?: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgb(3 20 30 / 35%)", zIndex: 50 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(500px, 92vw)", maxHeight: "90vh", zIndex: 51 }}>
        <div style={{
          background: "var(--color-surface)",
          borderRadius: "12px", padding: "clamp(16px,4vw,24px)",
          border: "1px solid var(--color-border)",
          opacity: 0, transform: "translateY(12px)",
          animation: "floatIn 0.3s cubic-bezier(0.16,1,0.3,1) forwards",
          maxHeight: "90vh", overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ ...headingSt, fontSize: "18px", margin: 0 }}>{title}</h3>
            {onClose && <button onClick={onClose} aria-label="Close" style={removeBtn}><X size={20} aria-hidden="true" style={{ color: "var(--color-text-muted)" }} /></button>}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function Chip({ icon, value, label, plural }: { icon: React.ReactNode; value: number; label: string; plural?: string }) {
  return (
    <span>
      {icon} {value} {value === 1 ? label : (plural ?? `${label}s`)}
    </span>
  );
}

function LoadingCard() {
  return (
    <div role="status" aria-label="Fetching batch" className={local.loading}>
      <div /><div /><div />
      <span className="sr-only">Fetching batch…</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px,4vw,24px)",
};

const headingSt: React.CSSProperties = {
  fontWeight: 600, color: "var(--color-text)", margin: 0,
};

const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
  minHeight: "44px", padding: "8px 16px", borderRadius: "12px",
  fontWeight: 600, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap",
};

const primaryBtn: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--green)", background: "var(--green)", color: "var(--dark-teal)",
};

const dangerBtn: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "#b83232",
};

const primaryBtnSm: React.CSSProperties = { ...primaryBtn, flex: 2 };

const ghostBtnSm: React.CSSProperties = {
  ...btnBase, flex: 1,
  border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)",
};

const removeBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: "44px", minHeight: "44px", background: "none", border: "none",
  color: "#b83232", cursor: "pointer", borderRadius: "8px", flexShrink: 0,
};

const inputSt: React.CSSProperties = {
  width: "100%", minHeight: "44px", padding: "8px 12px",
  background: "var(--color-surface)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "8px", color: "var(--color-text)",
  fontSize: "14px", boxSizing: "border-box",
};

const fieldLabelSt: React.CSSProperties = {
  display: "block", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", marginBottom: "6px",
};

const thSt: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)",
};

const tdSt: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left", color: "var(--color-text-muted)", fontSize: "13px",
};

const errorBox: React.CSSProperties = {
  padding: "10px 14px", borderRadius: "8px",
  background: "rgba(184,50,50,0.06)", border: "1px solid rgba(184,50,50,0.2)",
  fontSize: "14px", color: "#b83232", fontWeight: 500,
};
