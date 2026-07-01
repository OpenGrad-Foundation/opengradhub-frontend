"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  addTrackerFields,
  assignTrackerTargets,
  createTrackerTemplate,
  type TrackerCompletionStyle,
  type TrackerField,
  type TrackerFieldSource,
  type TrackerFieldType,
} from "@/lib/tracker-api";
import { useInvalidate } from "@/lib/mutations/invalidation";

// Mirrors the backend PROFILE_ALLOWLIST (src/tracker/tracker.constants.ts).
const PROFILE_PATHS = [
  "student.name",
  "student.category",
  "student.district",
  "student.contact",
  "school.name",
  "school.code",
] as const;

const FIELD_TYPES: TrackerFieldType[] = ["text", "number", "date", "select", "multiselect", "boolean", "url"];
const SOURCES: TrackerFieldSource[] = ["input", "identity", "profile"];

type DraftColumn = {
  field_key: string;
  label: string;
  field_type: TrackerFieldType;
  optionsText: string;
  source: TrackerFieldSource;
  source_path: string;
  required: boolean;
};

const emptyColumn = (): DraftColumn => ({
  field_key: "",
  label: "",
  field_type: "text",
  optionsText: "",
  source: "input",
  source_path: PROFILE_PATHS[0],
  required: false,
});

export function TrackerBuilder({ canAuthor }: { canAuthor: boolean }) {
  const invalidate = useInvalidate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [completionStyle, setCompletionStyle] = useState<TrackerCompletionStyle>("checklist");
  const [statusesText, setStatusesText] = useState("");
  const [doneStatus, setDoneStatus] = useState("");
  const [deadline, setDeadline] = useState("");
  const [columns, setColumns] = useState<DraftColumn[]>([emptyColumn()]);
  const [assignIdsText, setAssignIdsText] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (!canAuthor) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
        <p className="text-sm font-medium text-red-800">Builder access requires tracker author permission.</p>
      </div>
    );
  }

  const setColumn = (i: number, patch: Partial<DraftColumn>) =>
    setColumns((cols) => cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const statuses = statusesText.split(",").map((s) => s.trim()).filter(Boolean);
      // Validate BEFORE creating anything so an invalid form never leaves an orphan template.
      if (completionStyle === "workflow") {
        if (statuses.length === 0) throw new Error("Workflow needs at least one status.");
        if (!statuses.includes(doneStatus.trim())) throw new Error("Done status must be one of the statuses.");
      }
      const fields: TrackerField[] = columns
        .filter((c) => c.field_key.trim() && c.label.trim())
        .map((c, idx) => ({
          field_key: c.field_key.trim(),
          label: c.label.trim(),
          field_type: c.field_type,
          options:
            c.field_type === "select" || c.field_type === "multiselect"
              ? c.optionsText.split(",").map((o) => o.trim()).filter(Boolean)
              : null,
          source: c.source,
          source_path: c.source === "profile" ? c.source_path : null,
          required: c.required,
          visible_if: null,
          sort_order: idx,
        }));
      for (const f of fields) {
        if ((f.field_type === "select" || f.field_type === "multiselect") && (!f.options || f.options.length === 0))
          throw new Error(`Column "${f.label}" needs at least one option.`);
      }

      const { id } = await createTrackerTemplate({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        target_type: "student",
        completion_style: completionStyle,
        workflow_statuses: completionStyle === "workflow" ? statuses : undefined,
        done_status: completionStyle === "workflow" ? doneStatus.trim() : undefined,
        deadline: deadline || undefined,
      });
      if (fields.length > 0) await addTrackerFields(id, { fields });

      const targetIds = assignIdsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      let assigned = 0;
      if (targetIds.length > 0) {
        const res = await assignTrackerTargets(id, targetIds);
        assigned = res.created;
      }

      await invalidate("tracker");
      setResult(`Created "${name.trim()}" with ${fields.length} column(s)` + (assigned ? `, assigned ${assigned} row(s).` : "."));
      setCode("");
      setName("");
      setDescription("");
      setStatusesText("");
      setDoneStatus("");
      setDeadline("");
      setColumns([emptyColumn()]);
      setAssignIdsText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task type.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Code
          <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="NEET-2026" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="NEET Application" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Completion style
          <select value={completionStyle} onChange={(e) => setCompletionStyle(e.target.value as TrackerCompletionStyle)} className={inputClass}>
            <option value="checklist">Checklist (done / not done)</option>
            <option value="workflow">Workflow (ordered statuses)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Deadline
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </label>
        {completionStyle === "workflow" && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Statuses (comma-separated)
              <input value={statusesText} onChange={(e) => setStatusesText(e.target.value)} placeholder="applied, paid, result" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Done status
              <input value={doneStatus} onChange={(e) => setDoneStatus(e.target.value)} placeholder="result" className={inputClass} />
            </label>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-950">Columns</h3>
          <button type="button" onClick={() => setColumns((c) => [...c, emptyColumn()])} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add column
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {columns.map((col, i) => (
            <div key={i} className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50/60 p-3 md:grid-cols-6">
              <input value={col.field_key} onChange={(e) => setColumn(i, { field_key: e.target.value })} placeholder="field_key" className={inputClass} />
              <input value={col.label} onChange={(e) => setColumn(i, { label: e.target.value })} placeholder="Label" className={inputClass} />
              <select value={col.field_type} onChange={(e) => setColumn(i, { field_type: e.target.value as TrackerFieldType })} className={inputClass}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={col.source} onChange={(e) => setColumn(i, { source: e.target.value as TrackerFieldSource })} className={inputClass}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {col.source === "profile" ? (
                <select value={col.source_path} onChange={(e) => setColumn(i, { source_path: e.target.value })} className={inputClass}>
                  {PROFILE_PATHS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (col.field_type === "select" || col.field_type === "multiselect") ? (
                <input value={col.optionsText} onChange={(e) => setColumn(i, { optionsText: e.target.value })} placeholder="opt1, opt2" className={inputClass} />
              ) : (
                <div />
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={col.required} onChange={(e) => setColumn(i, { required: e.target.checked })} /> Required
                </label>
                <button type="button" onClick={() => setColumns((c) => c.filter((_, idx) => idx !== i))} aria-label="Remove column" className="text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Assign to students (IDs, comma or space separated — optional)
          <textarea value={assignIdsText} onChange={(e) => setAssignIdsText(e.target.value)} rows={2} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />
        </label>
        <p className="mt-1 text-xs text-gray-500">Only students within your scope are assigned; others are skipped.</p>
      </section>

      {error && <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {result && <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>}

      <div>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Create task type
        </button>
      </div>
    </form>
  );
}
