"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Download, FileUp, Loader2, Save, ShieldAlert, UserCog, X } from "lucide-react";
import {
  useClearTrackerBlocker,
  useRaiseTrackerBlocker,
  useRecordGeoVerification,
  useSaveTrackerBatch,
  useSaveTrackerBatchOnBehalf,
  useTemplateGeoVerifications,
  useTrackerRecordHistory,
} from "@/lib/queries/tracker";
import { fetchTaskExport } from "@/lib/tracker-api";
import type { TrackerBatchEdit, TrackerEvent, TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";
import { taskStateFromLifecycle, TASK_STATE_META, TASK_STATE_ORDER, type TaskState } from "@/lib/tracker-status";
import { IN_CHARGE, roleLabel } from "@/lib/labels";
import { RecordProofs } from "./record-proofs";
import { ExtensionPanel } from "./extension-panel";
import { PeriodHistory } from "./period-history";
import { GeoStatusChip, GeoVerificationModal } from "./geo-verification-modal";
import { StudentDetailsForm } from "./student-details-form";
import { displayCellValue as display } from "@/lib/tracker-value";
import { groupEditsByAuthority, rowAuthority } from "@/lib/tracker-authority";
import { TrackerBulkUploadPanel } from "./tracker-bulk-upload-panel";

type RowDraft = { values: Record<string, unknown>; status?: string };

const menuClass = "absolute right-0 top-full z-30 mt-1 w-64 rounded-md border border-gray-200 bg-white py-1 shadow-lg";
const menuItemClass = "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

export function TrackerEditableGrid({
  template,
  grid,
  canFill,
  canClear,
  statusFilter = "",
  onStatusFilterChange,
  visibleRows: visibleRowsProp,
  filterBar,
  canOverrideGeo = false,
  canGrantExtension = false,
  canOverrideFill = false,
  canExport = false,
  owner = null,
}: {
  template: TrackerTemplate;
  grid: TrackerGrid;
  canFill: boolean;
  canClear: boolean;
  /** 4-state status filter shared with the card strip above the grid. */
  statusFilter?: TaskState | "";
  onStatusFilterChange?: (state: TaskState | "") => void;
  /** The rows the active filters admit. `grid.rows` stays the WHOLE set: the
   *  school-verification map, the override count and the full export all describe
   *  the task, not the current view, and quietly narrowing them would understate
   *  how much work is really there. */
  visibleRows?: TrackerGridRow[];
  /** The filter row itself, owned by the panel above so the status cards can count
   *  the same set the table shows. */
  filterBar?: React.ReactNode;
  /** May the viewer accept an out-of-range verification? */
  canOverrideGeo?: boolean;
  /** May the viewer reopen an overdue row with a dated extension? */
  canGrantExtension?: boolean;
  /** May the viewer fill these rows in the doer's name? (tracker.fill.override, and the
   *  doer must be below them — the server checks both again.) */
  canOverrideFill?: boolean;
  /** May the viewer download the whole task as a file? Managers only: it is the one
   *  control here that hands over every row at once rather than a screenful. */
  canExport?: boolean;
  /** The person whose rows these are, when drilled in. Names the banner and resets
   *  override mode when the manager switches to someone else. */
  owner?: { id: string; name: string } | null;
}) {
  // Unfiltered by default: a grid rendered without a filter set shows all its rows.
  const visibleRows = visibleRowsProp ?? grid.rows;
  const save = useSaveTrackerBatch();
  const saveOnBehalf = useSaveTrackerBatchOnBehalf();
  const raise = useRaiseTrackerBlocker();
  const clear = useClearTrackerBlocker();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  // Filling in someone else's name is a deliberate mode, never the default: a manager
  // drills in to LOOK far more often than to write, and a stray keystroke must not
  // silently become a completion in a fellow's name. Holding the reason here also means
  // one prompt per session rather than one per row.
  const [onBehalf, setOnBehalf] = useState<{ reason: string } | null>(null);
  const [reasonPrompt, setReasonPrompt] = useState<string | null>(null);
  const [blockerText, setBlockerText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // One pending state for the whole operation: a save may now be several requests.
  const [saving, setSaving] = useState(false);
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);
  // Open the "Additional Student Details" form for a student-target row.
  const [detailsStudent, setDetailsStudent] = useState<{ id: string; name: string } | null>(null);
  const isStudentTarget = template.target_type === "student";
  const onBehalfMode = Boolean(onBehalf);
  const doneStatus = template.completion_style === "workflow" ? (template.done_status ?? "done") : "done";

  // An override FILLS outstanding work; the server refuses a row that is already complete.
  // Both of these read the SERVER status, never the draft — otherwise ticking a row in an
  // on-behalf session would immediately lock the control the manager just used.
  const rowComplete = (row: TrackerGridRow) => row.status === doneStatus;
  // Nothing outstanding anywhere in the task means there is nothing to fill on behalf of,
  // so the session must not be enterable at all rather than dead-ending at Save.
  const overridableCount = grid.rows.filter((r) => rowAuthority(r).override && !rowComplete(r)).length;

  // Authority is a property of the ROW, not of the route that reached this grid. The server
  // sends it per row because its view scope is deliberately wider than its fill scope: a
  // manager supervises rows they may not fill, and offering the ordinary controls on those
  // rows is what produced the "out of scope" error on save.
  const authorityOf = (row: TrackerGridRow) => rowAuthority(row);
  /** A row whose capabilities are missing came from a payload older than this contract. */
  const staleAuthority = grid.rows.some((r) => !authorityOf(r).known);
  /** Per row: an on-behalf session may only touch outstanding rows the viewer may override. */
  const overridingRow = (row: TrackerGridRow) => onBehalfMode && authorityOf(row).override;
  const canEditRow = (row: TrackerGridRow) =>
    (canFill && authorityOf(row).self) || (overridingRow(row) && !rowComplete(row));
  /** Does the viewer own ANY row here? Gates the toolbar's doer-only menus. */
  const anyOwnRow = canFill && grid.rows.some((r) => authorityOf(r).evidence);
  /** Everyone whose rows this grid may fill on behalf of — a drill-in has exactly one. */
  const overrideDoers = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of grid.rows) {
      if (rowAuthority(r).override && r.doer_id) names.set(r.doer_id, r.doer_name ?? "a team member");
    }
    return names;
  }, [grid.rows]);
  const sessionLabel = owner?.name
    ?? (overrideDoers.size === 1 ? [...overrideDoers.values()][0] : `${overrideDoers.size} team members`);
  /** Only the on-behalf drafts are discarded by Exit; own-row work survives it. */
  const overrideDirtyCount = Object.entries(drafts).filter(([id, d]) => {
    if (!(Object.keys(d.values).length > 0 || d.status !== undefined)) return false;
    const row = grid.rows.find((r) => r.record_id === id);
    return row ? rowAuthority(row).override : false;
  }).length;

  // Switching to another person or another task ends the session: its reason described the
  // rows that were on screen when it was given, and must not follow the manager elsewhere.
  useEffect(() => {
    setOnBehalf(null);
    setReasonPrompt(null);
    setDrafts({});
  }, [template.id, owner?.id]);
  const canOpenDetails = (row: TrackerGridRow): row is TrackerGridRow & { target_id: string } =>
    authorityOf(row).evidence && isStudentTarget && Boolean(row.target_id);
  const [proofReady, setProofReady] = useState<Record<string, boolean>>({});
  const requiresProof = template.require_photo || template.require_location;
  // Shared school-visit verification: ONE per school, consumed by every row for that
  // school. Fetched once here (React Query dedupes with the panel's own read) so the
  // done control can show why a row is blocked. The server remains authoritative.
  const requiresGeo = Boolean(template.require_geo_verification);
  const geoQuery = useTemplateGeoVerifications(template.id, requiresGeo);
  const geoAcceptedSchools = useMemo(() => {
    // One verification exists per (template, period, school, DOER). Keying by school alone
    // would let one In-Charge's visit photo complete another In-Charge's row — invisible
    // until a grid mixes doers, which per-row authority now makes ordinary.
    const accepted = new Set<string>();
    for (const v of geoQuery.data ?? []) if (v.accepted) accepted.add(`${v.school_id}::${v.doer_id}`);
    return accepted;
  }, [geoQuery.data]);
  const geoAccepted = (row: TrackerGridRow) =>
    Boolean(row.school_id && row.doer_id && geoAcceptedSchools.has(`${row.school_id}::${row.doer_id}`));
  // The verification dialog: opened from the toolbar chip (browse/replace a photo) or
  // by the gate itself, when a row cannot reach done without its school verified.
  const [geoModal, setGeoModal] = useState<{ schoolId: string | null; blocking: boolean } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exporting, setExporting] = useState<"records" | "history" | null>(null);
  // One open menu at a time, and one wrapper to detect a click outside either of them.
  const [menu, setMenu] = useState<"export" | "bulk" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menu]);

  const editableKeys = useMemo(
    () => new Set(grid.columns.filter((c) => c.source !== "profile").map((c) => c.field_key)),
    [grid.columns],
  );

  const hasSchool = grid.rows.some((r) => r.school_name);
  // For student/fellow rows, show WHO the row is about (the school column already covers schools).
  const hasName = template.target_type !== "school" && grid.rows.some((r) => r.target_name);
  const nameHeader = template.target_type === "fellow" ? IN_CHARGE : "Student";
  const dirtyCount = Object.values(drafts).filter((d) => Object.keys(d.values).length > 0 || d.status !== undefined).length;

  function setCell(recordId: string, key: string, value: unknown) {
    setDrafts((d) => ({ ...d, [recordId]: { ...d[recordId], values: { ...(d[recordId]?.values ?? {}), [key]: value } } }));
  }
  function setStatus(recordId: string, status: string) {
    setDrafts((d) => ({ ...d, [recordId]: { ...d[recordId], values: d[recordId]?.values ?? {}, status } }));
  }

  /**
   * One Save, several requests. A mixed grid holds rows the viewer owns and rows they may
   * only override, and those take different endpoints: the override route refuses a
   * self-override outright and accepts a single doer per request. Groups are sent in turn and
   * accounted for separately, so one refusal cannot discard another group's work.
   */
  async function onSave() {
    setError(null);
    // Snapshot at click: anything typed while the requests are in flight is a NEW draft and
    // must survive, so only these record ids are cleared on success.
    const submitted: TrackerBatchEdit[] = Object.entries(drafts)
      .filter(([, d]) => Object.keys(d.values).length > 0 || d.status !== undefined)
      .map(([record_id, d]) => ({ record_id, values: d.values, status: d.status }));
    if (submitted.length === 0) return;
    const rowsById = new Map(grid.rows.map((r) => [r.record_id, r]));
    const { own, byDoer, skipped } = groupEditsByAuthority(submitted, rowsById);
    const message = (err: unknown) => (err instanceof Error ? err.message : "Save failed.");
    const saved: string[] = [];
    const failures: string[] = [];
    setSaving(true);
    try {
      if (own.length) {
        try {
          await save.mutateAsync(own);
          saved.push(...own.map((e) => e.record_id));
        } catch (err) { failures.push(`Your own rows: ${message(err)}`); }
      }
      for (const group of byDoer) {
        // Reached only inside a session: without a reason there is nothing to record.
        if (!onBehalf) break;
        try {
          await saveOnBehalf.mutateAsync({ reason: onBehalf.reason, edits: group.edits });
          saved.push(...group.edits.map((e) => e.record_id));
        } catch (err) {
          failures.push(`${group.doerName ?? "One team member"}'s rows: ${message(err)}`);
        }
      }
    } finally {
      setSaving(false);
    }
    // Clear ONLY what the server acknowledged. A failed group keeps its drafts for review and
    // is never re-routed into a different write path behind the manager's back.
    if (saved.length) setDrafts((d) => {
      const next = { ...d };
      for (const id of saved) delete next[id];
      return next;
    });
    if (skipped) {
      failures.push(
        `${skipped} row${skipped === 1 ? "" : "s"} could not be saved from here — refresh and try again.`);
    }
    setError(failures.length ? failures.join(" ") : null);
  }

  function startOnBehalf(reason: string) {
    const text = reason.trim();
    if (!text) return;
    setOnBehalf({ reason: text });
    setReasonPrompt(null);
  }

  function exitOnBehalf() {
    // Ending the session discards what was typed in someone else's name. The viewer's OWN
    // rows were never part of it — they take the ordinary route — so their edits stay.
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => {
      const row = grid.rows.find((r) => r.record_id === id);
      return row ? rowAuthority(row).self : false;
    })));
    setOnBehalf(null);
    setError(null);
  }

  async function onDownloadTemplate(format: "csv" | "xlsx") {
    setError(null);
    try {
      const { downloadGridTemplate } = await import("@/lib/tracker-bulk-file");
      await downloadGridTemplate(template.name, grid.columns, visibleRows, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the file.");
    }
  }

  // The server builds this file from the same scope that produced the grid, so what
  // lands on disk is exactly what is loaded here — including the rows the on-screen
  // filters are hiding, which is what a manager chasing stragglers actually wants.
  async function onExport(history: boolean) {
    setError(null);
    setExporting(history ? "history" : "records");
    try {
      const { blob, filename } = await fetchTaskExport(template.id, { history, ownerId: owner?.id });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export this task.");
    } finally {
      setExporting(null);
    }
  }

  async function onRaise(recordId: string) {
    const text = (blockerText[recordId] ?? "").trim();
    if (!text) return;
    setError(null);
    try {
      await raise.mutateAsync({ recordId, text });
      setBlockerText((b) => ({ ...b, [recordId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the note.");
    }
  }

  async function onClear(blockerId: string) {
    setError(null);
    try {
      await clear.mutateAsync(blockerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear the blocker.");
    }
  }

  const inputClass = "h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-100";

  // Shared cell renderers, reused by the desktop table and the mobile card list.
  const proofHint = template.require_photo && template.require_location ? "Add a photo and capture your location first"
    : template.require_photo ? "Add a photo first" : "Capture your location first";
  const onProofReady = (recordId: string) => (ready: boolean) =>
    setProofReady((s) => (s[recordId] === ready ? s : { ...s, [recordId]: ready }));
  const proofsFor = (row: TrackerGridRow) => (
    <RecordProofs
      recordId={row.record_id}
      requirePhoto={template.require_photo}
      requireLocation={template.require_location}
      editable={row.status !== "done" && authorityOf(row).evidence}
      onReadyChange={onProofReady(row.record_id)}
    />
  );
  const statusControl = (row: TrackerGridRow, big: boolean) => {
    const currentStatus = drafts[row.record_id]?.status ?? row.status;
    // Block reaching the done status client-side until required proofs exist (the server
    // 409s regardless; this just avoids a dead-end). Applies to workflow + checklist.
    // RecordProofs only mounts on rows the viewer owns, so its readiness signal cannot be the
    // only source: on a row without that control, missing proof would silently read as met.
    const proofSeed = (!template.require_photo || row.has_photo_proof === true)
      && (!template.require_location || row.has_location_proof === true);
    const proofUnmet = requiresProof && currentStatus !== doneStatus
      && (proofReady[row.record_id] ?? proofSeed) === false;
    // A row cannot reach done until its SCHOOL has an accepted visit verification.
    // Purely a convenience: batchSave enforces the same rule inside its transaction.
    const geoUnmet = requiresGeo && currentStatus !== doneStatus && !geoAccepted(row);
    // Overdue outranks the proof/geo reasons: no photo can unblock it, only a
    // manager's extension, so the fellow is told the real blocker.
    const overdue = row.lifecycle === "overdue" && currentStatus !== doneStatus;
    const blockedHint = overdue
      ? "Overdue — ask your ZM or PM for an extension"
      : geoUnmet ? geoHint(row) : proofHint;
    // A missing visit verification is the one blocker the fellow can clear from here, so
    // it does NOT disable the control: reaching for done opens the verification dialog
    // instead of dead-ending on a greyed-out checkbox. Overdue and a school-less row keep
    // disabling it — no photo can fix either.
    const gateable = authorityOf(row).evidence && geoUnmet && !overdue && !proofUnmet && Boolean(row.school_id);
    // What WOULD stop an ordinary fill. In an on-behalf session the server waives all of it,
    // so the control must not stay locked and the hint must not tell the very manager who can
    // now complete the row to go ask a manager for an extension.
    const gated = overdue || proofUnmet || (geoUnmet && !gateable);
    // Only the rows being filled in someone else's name waive anything: an own row inside a
    // mixed session still takes the ordinary route, which enforces every gate.
    const overriding = overridingRow(row);
    const blocked = gated && !overriding;
    const waiving = gated && overriding;
    const openGate = () => setGeoModal({ schoolId: row.school_id ?? null, blocking: true });
    const lockedComplete = overriding && rowComplete(row);
    const hint = lockedComplete
      ? "Already complete — an override fills outstanding work, it does not rewrite finished work"
      : waiving
        ? "Completing this waives its requirements — recorded in the history"
        : blockedHint;
    if (template.completion_style === "workflow") {
      return (
        <div className="flex flex-col gap-1">
          <select
            value={currentStatus}
            disabled={!canEditRow(row)}
            onChange={(e) => {
              if (gateable && e.target.value === doneStatus) { openGate(); return; }
              setStatus(row.record_id, e.target.value);
            }}
            className={big ? "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base outline-none focus:border-teal-500" : inputClass}
          >
            {(template.workflow_statuses ?? []).map((s) => <option key={s} value={s} disabled={blocked && s === doneStatus}>{s}</option>)}
          </select>
          {(blocked || waiving || gateable || lockedComplete) && <p className="text-xs text-amber-700">{hint}</p>}
        </div>
      );
    }
    const done = currentStatus === "done";
    const proofBlocking = blocked;
    if (big) {
      return (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!canEditRow(row) || proofBlocking}
            onClick={() => {
              if (gateable) { openGate(); return; }
              setStatus(row.record_id, done ? "not_started" : "done");
            }}
            className={"flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition disabled:opacity-60 " + (done ? "bg-emerald-600 text-white" : "border-2 border-gray-300 text-gray-700")}
          >
            <Check className="h-5 w-5" aria-hidden="true" /> {done ? "Done" : "Mark done"}
          </button>
          {(proofBlocking || waiving || gateable || lockedComplete) && <p className="text-center text-xs text-amber-700">{hint}</p>}
        </div>
      );
    }
    return (
      <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600" title={proofBlocking || waiving || gateable || lockedComplete ? hint : undefined}>
        <input
          type="checkbox"
          disabled={!canEditRow(row) || proofBlocking}
          checked={done}
          onChange={(e) => {
            if (gateable) { openGate(); return; }
            setStatus(row.record_id, e.target.checked ? "done" : "not_started");
          }}
        />
        {done ? "Done" : "Open"}
      </label>
    );
  };

  const fieldControl = (row: TrackerGridRow, col: TrackerGrid["columns"][number]) => {
    const draft = drafts[row.record_id];
    const cell = row.cells.find((c) => c.field_key === col.field_key);
    const editable = canEditRow(row) && editableKeys.has(col.field_key);
    const draftVal = draft?.values[col.field_key];
    const value = draftVal !== undefined ? draftVal : cell?.value;
    if (!editable) {
      if (cell?.notSet) {
        // A locked, auto-filled cell with no value on a student row is a dead end today —
        // let a fellow who can fill open the student's details form to supply it.
        if (cell.locked && canOpenDetails(row)) {
          return (
            <button
              type="button"
              onClick={() => setDetailsStudent({ id: row.target_id, name: row.target_name ?? "this student" })}
              title="Fill student details"
              className="text-gray-500 underline decoration-dashed underline-offset-2 hover:text-teal-700"
            >
              Not set
            </button>
          );
        }
        return <span className="text-gray-400">Not set</span>;
      }
      return <span>{display(value)}</span>;
    }
    return <EditableCell col={col} value={value} onChange={(v) => setCell(row.record_id, col.field_key, v)} inputClass={inputClass} />;
  };

  const blockerControl = (row: TrackerGridRow) => {
    if (row.blocker) {
      return (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-red-700">{row.blocker.text}</p>
          {canClear && (
            <button
              type="button"
              onClick={() => onClear(row.blocker!.id)}
              disabled={clear.isPending}
              className="inline-flex w-fit items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Mark cleared
            </button>
          )}
        </div>
      );
    }
    if (!authorityOf(row).blocker) return <span className="text-gray-400">—</span>;
    return (
      <div className="flex items-center gap-1">
        <input
          value={blockerText[row.record_id] ?? ""}
          onChange={(e) => setBlockerText((b) => ({ ...b, [row.record_id]: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") onRaise(row.record_id); }}
          placeholder="What's stuck?"
          className="h-9 w-full min-w-0 rounded border border-gray-300 px-2 text-sm outline-none focus:border-teal-500"
        />
        <button
          type="button"
          onClick={() => onRaise(row.record_id)}
          disabled={raise.isPending || !(blockerText[row.record_id] ?? "").trim()}
          className="shrink-0 rounded border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    );
  };

  const historyButton = (row: TrackerGridRow) => (
    <button
      type="button"
      onClick={() => setHistoryRecordId(row.record_id)}
      className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> History
    </button>
  );

  const detailsButton = (row: TrackerGridRow) =>
    canOpenDetails(row) ? (
      <button
        type="button"
        onClick={() => setDetailsStudent({ id: row.target_id, name: row.target_name ?? "this student" })}
        className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <UserCog className="h-3.5 w-3.5" aria-hidden="true" /> Details
      </button>
    ) : null;

  // The card must NOT clip its own overflow: the toolbar menus are absolutely positioned
  // and an overflow-hidden here cuts them off at the card's edge, whatever their z-index.
  // The two row containers below round their own bottom corners instead.
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      {filterBar ? <div className="border-b border-gray-100 px-4 py-3">{filterBar}</div> : null}
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-950">{template.name}</h2>
          <select value={statusFilter} onChange={(e) => onStatusFilterChange?.(e.target.value as TaskState | "")} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-teal-500">
            <option value="">All statuses</option>
            {TASK_STATE_ORDER.map((s) => <option key={s} value={s}>{TASK_STATE_META[s].label}</option>)}
          </select>
          <GeoStatusChip
            template={template}
            // Every school of the task, not just the filtered subset: the count must
            // reflect what still blocks the task, not what is on screen.
            rows={grid.rows}
            onOpen={() => setGeoModal({ schoolId: null, blocking: false })}
          />
        </div>
        {/* Offered wherever an overridable row exists — the ROW says so, not the route. */}
        {!onBehalfMode && canOverrideFill && grid.rows.some((r) => rowAuthority(r).override) && (
          <button
            type="button"
            onClick={() => setReasonPrompt("")}
            disabled={overridableCount === 0}
            title={overridableCount === 0
              ? "Every row here is already complete — there is nothing to fill on their behalf"
              : `Fill ${overridableCount} outstanding row${overridableCount === 1 ? "" : "s"} in their name`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Fill on behalf
          </button>
        )}
        {/* Both files are downloads and neither is the other's format, so each hides behind
            its own menu rather than sitting in the toolbar as a pair of look-alike CSV
            buttons: Export is the manager's report, Bulk fill is the doer's round-trip. */}
        <div ref={menuRef} className="flex shrink-0 items-center gap-2">
          {canExport && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => (m === "export" ? null : "export"))}
                disabled={exporting !== null}
                aria-haspopup="menu"
                aria-expanded={menu === "export"}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                Export
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              </button>
              {menu === "export" && (
                <div role="menu" className={menuClass}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(null); void onExport(false); }}
                    className={menuItemClass}
                  >
                    <span className="font-medium text-gray-800">Records only (.csv)</span>
                    <span className="text-[11px] text-gray-500">All {grid.rows.length} rows with status, evidence and last update</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(null); void onExport(true); }}
                    className={menuItemClass}
                  >
                    <span className="font-medium text-gray-800">Records + history (.zip)</span>
                    <span className="text-[11px] text-gray-500">Adds the full event log, one row per change</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {(anyOwnRow || onBehalfMode) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => (m === "bulk" ? null : "bulk"))}
                aria-haspopup="menu"
                aria-expanded={menu === "bulk"}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileUp className="h-3.5 w-3.5" aria-hidden="true" /> Bulk fill
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              </button>
              {menu === "bulk" && (
                <div role="menu" className={menuClass}>
                  {/* Carries exactly the rows on screen, so the filters above decide what goes
                      in the file. Unsaved edits are excluded, so it waits until they are saved. */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(null); void onDownloadTemplate("csv"); }}
                    disabled={dirtyCount > 0 || visibleRows.length === 0}
                    title={dirtyCount > 0 ? "Save your changes first" : undefined}
                    className={menuItemClass}
                  >
                    <span className="font-medium text-gray-800">Download template (CSV)</span>
                    <span className="text-[11px] text-gray-500">{visibleRows.length} rows, ready to fill in</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(null); void onDownloadTemplate("xlsx"); }}
                    disabled={dirtyCount > 0 || visibleRows.length === 0}
                    title={dirtyCount > 0 ? "Save your changes first" : undefined}
                    className={menuItemClass}
                  >
                    <span className="font-medium text-gray-800">Download template (Excel)</span>
                    <span className="text-[11px] text-gray-500">Same rows as an .xlsx workbook</span>
                  </button>
                  {anyOwnRow && (
                    <>
                      <span className="my-1 block h-px bg-gray-100" aria-hidden="true" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenu(null); setBulkOpen(true); }}
                        disabled={dirtyCount > 0}
                        title={dirtyCount > 0 ? "Save your changes first" : undefined}
                        className={menuItemClass}
                      >
                        <span className="font-medium text-gray-800">Upload filled file…</span>
                        <span className="text-[11px] text-gray-500">Check it against these rows, then save</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {(anyOwnRow || onBehalfMode) && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving || dirtyCount === 0}
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {onBehalfMode ? "Save on behalf" : "Save"}{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </button>
          )}
        </div>
      </div>
      {onBehalfMode && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-xs text-amber-900">
            <span className="font-semibold">
              Filling as {sessionLabel}
            </span>
            {" — recorded in this task's history with your name and reason."}
            <span className="mt-0.5 block text-amber-800">&ldquo;{onBehalf?.reason}&rdquo;</span>
          </p>
          <button
            type="button"
            onClick={exitOnBehalf}
            className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            {overrideDirtyCount > 0 ? `Exit (discards ${overrideDirtyCount})` : "Exit"}
          </button>
        </div>
      )}
      {reasonPrompt !== null && (
        <ReasonPrompt
          ownerName={sessionLabel}
          value={reasonPrompt}
          onChange={setReasonPrompt}
          onCancel={() => setReasonPrompt(null)}
          onConfirm={() => startOnBehalf(reasonPrompt)}
        />
      )}
      {bulkOpen && (
        <TrackerBulkUploadPanel
          template={template}
          columns={grid.columns}
          rows={visibleRows.filter((r) => authorityOf(r).evidence)}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {staleAuthority && (
        /* A payload older than per-row authority. Those rows render read-only rather than
           guessing from the route — the guess is what produced "out of scope" on save. The
           grid query refetches on focus and after its stale time, so this clears itself. */
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Some rows are still loading their permissions and stay read-only until they do.
          Refresh if this does not clear.
        </p>
      )}
      {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <div className="hidden overflow-x-auto rounded-b-lg md:block">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-3 font-semibold">{template.completion_style === "workflow" ? "Stage" : "Done?"}</th>
              {hasName && <th className="px-3 py-3 font-semibold">{nameHeader}</th>}
              {hasSchool && <th className="px-3 py-3 font-semibold">School</th>}
              {grid.columns.map((c) => (
                <th key={c.field_key} className="px-3 py-3 font-semibold">{c.label}</th>
              ))}
              <th className="px-3 py-3 font-semibold">Blocker</th>
              <th className="px-3 py-3 font-semibold">Log</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <Fragment key={row.record_id}>
                <tr className="border-t border-gray-100 align-top">
                  <td className="px-3 py-3">{statusControl(row, false)}</td>
                  {hasName && <td className="px-3 py-3 font-medium text-gray-900">{row.target_name ?? "—"}</td>}
                  {hasSchool && <td className="px-3 py-3 text-gray-700">{row.school_name ?? "—"}</td>}
                  {grid.columns.map((col) => (
                    <td key={col.field_key} className="px-3 py-3 text-gray-700">{fieldControl(row, col)}</td>
                  ))}
                  <td className="px-3 py-3">{blockerControl(row)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {historyButton(row)}
                      {detailsButton(row)}
                    </div>
                  </td>
                </tr>
                {authorityOf(row).evidence && requiresProof && (
                  <tr className="border-t border-gray-50">
                    <td colSpan={99} className="px-3 pb-3">{proofsFor(row)}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per row — big tap targets, stacked fields, no horizontal scroll. */}
      <div className="flex flex-col gap-3 overflow-hidden rounded-b-lg p-3 md:hidden">
        {visibleRows.map((row) => (
          <div key={row.record_id} className="rounded-lg border border-gray-200 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-950">{row.target_name ?? "—"}</p>
                {row.school_name && <p className="truncate text-xs text-gray-500">{row.school_name}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {detailsButton(row)}
                {historyButton(row)}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {grid.columns.map((col) => (
                <label key={col.field_key} className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  {col.label}
                  <div className="text-sm text-gray-800">{fieldControl(row, col)}</div>
                </label>
              ))}
            </div>
            {authorityOf(row).evidence && requiresProof && <div className="mt-3">{proofsFor(row)}</div>}
            <div className="mt-3">{statusControl(row, true)}</div>
            <div className="mt-3 border-t border-gray-100 pt-3">{blockerControl(row)}</div>
          </div>
        ))}
      </div>

      {historyRecordId && (
        <HistoryDrawer
          recordId={historyRecordId}
          requirePhoto={template.require_photo}
          requireLocation={template.require_location}
          requireGeo={requiresGeo}
          recurring={Boolean(template.recurrence_frequency)}
          overdue={grid.rows.find((r) => r.record_id === historyRecordId)?.lifecycle === "overdue"}
          canGrantExtension={canGrantExtension}
          onClose={() => setHistoryRecordId(null)}
        />
      )}

      {geoModal && (
        <GeoVerificationModal
          template={template}
          rows={grid.rows}
          initialSchoolId={geoModal.schoolId}
          blocking={geoModal.blocking}
          canFill={anyOwnRow}
          readOnly={!anyOwnRow}
          canOverride={canOverrideGeo}
          onClose={() => setGeoModal(null)}
        />
      )}

      {detailsStudent && (
        <StudentDetailsForm
          studentId={detailsStudent.id}
          studentName={detailsStudent.name}
          onClose={() => setDetailsStudent(null)}
        />
      )}
    </section>
  );
}

/** One reason for the whole session. Asked before anything becomes editable, so the manager
 *  states why BEFORE they write rather than justifying afterwards. */
function ReasonPrompt({
  ownerName,
  value,
  onChange,
  onCancel,
  onConfirm,
}: {
  ownerName: string;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-950">Fill on behalf of {ownerName}</h3>
        <p className="mt-1 text-sm text-gray-600">
          You are about to fill these rows in their name. It is recorded in the task history with
          your name and this reason, and {ownerName} is notified — along with their manager, if
          that is not you.
        </p>
        <label className="mt-4 block text-xs font-medium text-gray-700">
          Why are you filling for them?
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. On emergency leave; visit confirmed by phone with the head teacher."
            className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-teal-500"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!value.trim()}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Start filling
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryDrawer({
  recordId, requirePhoto, requireLocation, requireGeo, recurring,
  overdue, canGrantExtension, onClose,
}: {
  recordId: string; requirePhoto: boolean; requireLocation: boolean;
  requireGeo: boolean; recurring: boolean;
  overdue: boolean; canGrantExtension: boolean; onClose: () => void;
}) {
  const { data, isLoading, error } = useTrackerRecordHistory(recordId);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Task history"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-950">History</h3>
          <button type="button" onClick={onClose} aria-label="Close history" className="rounded p-1 text-gray-400 hover:text-gray-700">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ExtensionPanel recordId={recordId} overdue={overdue} canGrant={canGrantExtension} />
          {requireGeo && <RecordGeoSummary recordId={recordId} />}
          {/* Earlier occurrences of this same task for this same target. Only the
              previous period renders up front; older ones load on demand. */}
          <PeriodHistory recordId={recordId} recurring={recurring} />
          {(requirePhoto || requireLocation) && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Proof</p>
              <RecordProofs recordId={recordId} requirePhoto={requirePhoto} requireLocation={requireLocation} editable={false} />
            </div>
          )}
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
          ) : error ? (
            <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load history."}</p>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-gray-500">No history yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900">{describeEvent(ev)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {ev.actor_name ? `${ev.actor_name} · ` : ""}{formatDateTime(ev.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

function describeEvent(ev: TrackerEvent): string {
  const d = ev.detail as Record<string, unknown>;
  switch (ev.event_type) {
    case "record_created":
      return "Task assigned";
    case "status_changed":
      return `Status: ${String(d.from ?? "—")} → ${String(d.to ?? "—")}`;
    case "values_changed": {
      const changed = (d.changed ?? {}) as Record<string, unknown>;
      const keys = Object.keys(changed);
      return keys.length ? `Updated ${keys.join(", ")}` : "Updated fields";
    }
    case "blocker_raised":
      return `Flagged stuck: "${String(d.text ?? "")}"`;
    case "blocker_comment":
      return `Response: ${String(d.text ?? "")}`;
    case "blocker_cleared":
      return "Blocker cleared";
    case "blocker_escalated":
      return `Escalated to ${roleLabel(d.to_role as string | null, "manager")}`;
    case "proof_photo_added":
      return "Photo added";
    case "proof_photo_removed":
      return "Photo removed";
    case "proof_location_captured":
      return "Location captured";
    case "filled_on_behalf": {
      const who = String(d.doer_name ?? "a team member");
      const skipped = Array.isArray(d.gates_skipped) ? (d.gates_skipped as string[]) : [];
      const status = d.status as { from?: string; to?: string } | undefined;
      const changed = Object.keys((d.changed ?? {}) as Record<string, unknown>);
      const what = [
        status?.to ? `status → ${status.to}` : null,
        changed.length ? `updated ${changed.join(", ")}` : null,
      ].filter(Boolean).join("; ");
      return [
        `Filled on behalf of ${who}`,
        what ? ` (${what})` : "",
        ` — "${String(d.reason ?? "")}"`,
        skipped.length ? ` · skipped: ${skipped.map(gateLabel).join(", ")}` : "",
      ].join("");
    }
    default:
      return ev.event_type;
  }
}

/** The completion gates an override may waive, in wording a manager reads rather than
 *  the enum the server stores. */
function gateLabel(gate: string): string {
  if (gate === "overdue") return "overdue deadline";
  if (gate === "photo") return "photo proof";
  if (gate === "location") return "location proof";
  if (gate === "geo") return "visit verification";
  return gate;
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function EditableCell({
  col,
  value,
  onChange,
  inputClass,
}: {
  col: TrackerGrid["columns"][number];
  value: unknown;
  onChange: (v: unknown) => void;
  inputClass: string;
}) {
  switch (col.field_type) {
    case "boolean":
      return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case "number":
      return <input type="number" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} className={inputClass} />;
    case "date":
      return <input type="date" value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)} className={inputClass} />;
    case "select":
      return (
        <select value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
          <option value="">—</option>
          {(col.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {(col.options ?? []).map((o) => {
            const on = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? selected.filter((x) => x !== o) : [...selected, o])}
                className={"rounded-full border px-2 py-0.5 text-xs " + (on ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 text-gray-600")}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    }
    default:
      return <input type={col.field_type === "url" ? "url" : "text"} value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className={inputClass} />;
  }
}

/** Why a row is blocked by the shared school-visit verification. */
function geoHint(row: TrackerGridRow): string {
  if (!row.school_id) return "This row has no school, so a visit cannot be verified";
  return "Verify the school visit above first";
}

/**
 * The shared school-visit verification this row consumed.
 *
 * Resolved from the row rather than duplicated onto it: one verification covers the
 * whole school visit, and creating a per-record copy just to make history render would
 * multiply the evidence (and the coordinates) across every row.
 */
function RecordGeoSummary({ recordId }: { recordId: string }) {
  const { data, isLoading } = useRecordGeoVerification(recordId);
  if (isLoading) {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading visit verification…
      </div>
    );
  }
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        School visit verification
      </p>
      {!data ? (
        <p className="text-xs text-gray-400">No visit verification for this row yet.</p>
      ) : (
        <div className="flex flex-col gap-1 rounded-md border border-gray-200 bg-gray-50/60 p-3 text-xs">
          <p className="font-medium text-gray-800">
            {data.override_by ? "Overridden" : data.status === "verified" ? "Verified" : "Outside radius"}
            {" · "}
            {data.distance_m >= 1000
              ? `${(data.distance_m / 1000).toFixed(1)} km`
              : `${Math.round(data.distance_m)} m`}{" "}
            from school (limit {data.radius_m} m)
          </p>
          <p className="text-gray-500">Photo taken {formatDateTime(data.exif_captured_at)}</p>
          {data.override_reason && (
            <p className="text-amber-800">Override reason: {data.override_reason}</p>
          )}
          <p className="text-gray-400">Shared across this school visit.</p>
        </div>
      )}
    </div>
  );
}
