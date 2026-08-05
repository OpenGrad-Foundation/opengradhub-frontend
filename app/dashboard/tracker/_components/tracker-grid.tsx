"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, Clock, Download, FileUp, Loader2, Save, UserCog, X } from "lucide-react";
import {
  useClearTrackerBlocker,
  useRaiseTrackerBlocker,
  useSaveTrackerBatch,
  useTrackerRecordHistory,
} from "@/lib/queries/tracker";
import type { TrackerBatchEdit, TrackerEvent, TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";
import { taskStateFromLifecycle, TASK_STATE_META, TASK_STATE_ORDER, type TaskState } from "@/lib/tracker-status";
import { RecordProofs } from "./record-proofs";
import { StudentDetailsForm } from "./student-details-form";
import { TrackerBulkUploadPanel } from "./tracker-bulk-upload-panel";

type RowDraft = { values: Record<string, unknown>; status?: string };

export function TrackerEditableGrid({
  template,
  grid,
  canFill,
  canClear,
  statusFilter = "",
  onStatusFilterChange,
}: {
  template: TrackerTemplate;
  grid: TrackerGrid;
  canFill: boolean;
  canClear: boolean;
  /** 4-state status filter shared with the card strip above the grid. */
  statusFilter?: TaskState | "";
  onStatusFilterChange?: (state: TaskState | "") => void;
}) {
  const save = useSaveTrackerBatch();
  const raise = useRaiseTrackerBlocker();
  const clear = useClearTrackerBlocker();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [blockerText, setBlockerText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [historyRecordId, setHistoryRecordId] = useState<string | null>(null);
  // Open the "Additional Student Details" form for a student-target row.
  const [detailsStudent, setDetailsStudent] = useState<{ id: string; name: string } | null>(null);
  const isStudentTarget = template.target_type === "student";
  const canOpenDetails = (row: TrackerGridRow): row is TrackerGridRow & { target_id: string } =>
    canFill && isStudentTarget && Boolean(row.target_id);
  const [proofReady, setProofReady] = useState<Record<string, boolean>>({});
  const requiresProof = template.require_photo || template.require_location;
  const [schoolFilter, setSchoolFilter] = useState("");
  const [search, setSearch] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  const editableKeys = useMemo(
    () => new Set(grid.columns.filter((c) => c.source !== "profile").map((c) => c.field_key)),
    [grid.columns],
  );

  const schools = useMemo(
    () => Array.from(new Set(grid.rows.map((r) => r.school_name).filter(Boolean) as string[])).sort(),
    [grid.rows],
  );
  const hasSchool = schools.length > 0;
  // For student/fellow rows, show WHO the row is about (the school column already covers schools).
  const hasName = template.target_type !== "school" && grid.rows.some((r) => r.target_name);
  const nameHeader = template.target_type === "fellow" ? "Fellow" : "Student";
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grid.rows.filter((r) =>
      (!schoolFilter || r.school_name === schoolFilter) &&
      (!statusFilter || taskStateFromLifecycle(r.lifecycle) === statusFilter) &&
      (!q || (r.target_name ?? "").toLowerCase().includes(q) || (r.school_name ?? "").toLowerCase().includes(q)
        || r.cells.some((c) => String(c.value ?? "").toLowerCase().includes(q))));
  }, [grid.rows, schoolFilter, statusFilter, search]);

  const dirtyCount = Object.values(drafts).filter((d) => Object.keys(d.values).length > 0 || d.status !== undefined).length;

  function setCell(recordId: string, key: string, value: unknown) {
    setDrafts((d) => ({ ...d, [recordId]: { ...d[recordId], values: { ...(d[recordId]?.values ?? {}), [key]: value } } }));
  }
  function setStatus(recordId: string, status: string) {
    setDrafts((d) => ({ ...d, [recordId]: { ...d[recordId], values: d[recordId]?.values ?? {}, status } }));
  }

  async function onSave() {
    setError(null);
    const edits: TrackerBatchEdit[] = Object.entries(drafts)
      .filter(([, d]) => Object.keys(d.values).length > 0 || d.status !== undefined)
      .map(([record_id, d]) => ({ record_id, values: d.values, status: d.status }));
    if (edits.length === 0) return;
    try {
      await save.mutateAsync(edits);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
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
  const doneStatus = template.completion_style === "workflow" ? (template.done_status ?? "done") : "done";
  const proofHint = template.require_photo && template.require_location ? "Add a photo and capture your location first"
    : template.require_photo ? "Add a photo first" : "Capture your location first";
  const onProofReady = (recordId: string) => (ready: boolean) =>
    setProofReady((s) => (s[recordId] === ready ? s : { ...s, [recordId]: ready }));
  const proofsFor = (row: TrackerGridRow) => (
    <RecordProofs
      recordId={row.record_id}
      requirePhoto={template.require_photo}
      requireLocation={template.require_location}
      editable={row.status !== "done"}
      onReadyChange={onProofReady(row.record_id)}
    />
  );
  const statusControl = (row: TrackerGridRow, big: boolean) => {
    const currentStatus = drafts[row.record_id]?.status ?? row.status;
    // Block reaching the done status client-side until required proofs exist (the server
    // 409s regardless; this just avoids a dead-end). Applies to workflow + checklist.
    const proofUnmet = requiresProof && currentStatus !== doneStatus && proofReady[row.record_id] === false;
    if (template.completion_style === "workflow") {
      return (
        <div className="flex flex-col gap-1">
          <select value={currentStatus} disabled={!canFill} onChange={(e) => setStatus(row.record_id, e.target.value)} className={big ? "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base outline-none focus:border-teal-500" : inputClass}>
            {(template.workflow_statuses ?? []).map((s) => <option key={s} value={s} disabled={proofUnmet && s === doneStatus}>{s}</option>)}
          </select>
          {proofUnmet && <p className="text-xs text-amber-700">{proofHint}</p>}
        </div>
      );
    }
    const done = currentStatus === "done";
    const proofBlocking = proofUnmet;
    if (big) {
      return (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!canFill || proofBlocking}
            onClick={() => setStatus(row.record_id, done ? "not_started" : "done")}
            className={"flex h-12 w-full items-center justify-center gap-2 rounded-lg text-base font-semibold transition disabled:opacity-60 " + (done ? "bg-emerald-600 text-white" : "border-2 border-gray-300 text-gray-700")}
          >
            <Check className="h-5 w-5" aria-hidden="true" /> {done ? "Done" : "Mark done"}
          </button>
          {proofBlocking && <p className="text-center text-xs text-amber-700">{proofHint}</p>}
        </div>
      );
    }
    return (
      <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600" title={proofBlocking ? proofHint : undefined}>
        <input type="checkbox" disabled={!canFill || proofBlocking} checked={done} onChange={(e) => setStatus(row.record_id, e.target.checked ? "done" : "not_started")} />
        {done ? "Done" : "Open"}
      </label>
    );
  };

  const fieldControl = (row: TrackerGridRow, col: TrackerGrid["columns"][number]) => {
    const draft = drafts[row.record_id];
    const cell = row.cells.find((c) => c.field_key === col.field_key);
    const editable = canFill && editableKeys.has(col.field_key);
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
    if (!canFill) return <span className="text-gray-400">—</span>;
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

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-950">{template.name}</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rows…" className="h-8 w-40 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-teal-500" />
          <select value={statusFilter} onChange={(e) => onStatusFilterChange?.(e.target.value as TaskState | "")} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-teal-500">
            <option value="">All statuses</option>
            {TASK_STATE_ORDER.map((s) => <option key={s} value={s}>{TASK_STATE_META[s].label}</option>)}
          </select>
          {schools.length > 1 && (
            <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs outline-none focus:border-teal-500">
              <option value="">All schools</option>
              {schools.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        {canFill && (
          <div className="flex items-center gap-2">
            {/* Downloads exactly the rows on screen, so the filters above decide what goes in
                the file. Unsaved edits are excluded, so it is disabled until they are saved. */}
            <div className="flex items-center rounded-md border border-gray-300">
              <button
                type="button"
                onClick={() => void onDownloadTemplate("csv")}
                disabled={dirtyCount > 0 || visibleRows.length === 0}
                title={dirtyCount > 0 ? "Save your changes first" : `Download ${visibleRows.length} rows as CSV`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> CSV
              </button>
              <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => void onDownloadTemplate("xlsx")}
                disabled={dirtyCount > 0 || visibleRows.length === 0}
                title={dirtyCount > 0 ? "Save your changes first" : `Download ${visibleRows.length} rows as Excel`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Excel
              </button>
            </div>
            {/* Also blocked while there are unsaved edits: those drafts stay in the form, and
                saving them afterwards would write over whatever the upload just brought in. */}
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              disabled={dirtyCount > 0}
              title={dirtyCount > 0 ? "Save your changes first" : "Upload a filled-in spreadsheet"}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden="true" /> Bulk upload
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={save.isPending || dirtyCount === 0}
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              Save{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
            </button>
          </div>
        )}
      </div>
      {bulkOpen && (
        <TrackerBulkUploadPanel
          template={template}
          columns={grid.columns}
          rows={visibleRows}
          onClose={() => setBulkOpen(false)}
        />
      )}
      {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      <div className="hidden overflow-x-auto md:block">
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
                {canFill && requiresProof && (
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
      <div className="flex flex-col gap-3 p-3 md:hidden">
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
            {canFill && requiresProof && <div className="mt-3">{proofsFor(row)}</div>}
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
          onClose={() => setHistoryRecordId(null)}
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

function HistoryDrawer({
  recordId, requirePhoto, requireLocation, onClose,
}: {
  recordId: string; requirePhoto: boolean; requireLocation: boolean; onClose: () => void;
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
      return `Escalated to ${roleLabel(String(d.to_role ?? ""))}`;
    case "proof_photo_added":
      return "Photo added";
    case "proof_photo_removed":
      return "Photo removed";
    case "proof_location_captured":
      return "Location captured";
    default:
      return ev.event_type;
  }
}

function roleLabel(code: string): string {
  if (code === "ZONAL_MANAGER") return "Zonal Manager";
  if (code === "PROGRAM_MANAGER") return "Program Manager";
  return code || "manager";
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

function display(value: unknown): string {
  if (value == null || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
