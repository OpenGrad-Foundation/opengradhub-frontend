"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  addTrackerFields,
  assignTrackerTargets,
  createTrackerTemplate,
  type TrackerCompletionStyle,
  type TrackerField,
  type TrackerFieldSource,
  type TrackerFieldType,
  type TrackerTargetType,
  type TrackerRecurrence,
} from "@/lib/tracker-api";
import { useTrackerAssignable } from "@/lib/queries/tracker";
import { useInvalidate } from "@/lib/mutations/invalidation";

// Mirrors the backend PROFILE_ALLOWLIST (src/tracker/tracker.constants.ts), per target type.
const FELLOW_PATHS = ["fellow.name", "fellow.email"] as const;
const SCHOOL_PATHS: readonly string[] = []; // school projection not wired yet
const pathsFor = (t: TrackerTargetType): readonly string[] => (t === "fellow" ? FELLOW_PATHS : SCHOOL_PATHS);
const sourcesFor = (t: TrackerTargetType): TrackerFieldSource[] =>
  pathsFor(t).length ? ["input", "identity", "profile"] : ["input", "identity"];

const FIELD_TYPES: TrackerFieldType[] = ["text", "number", "date", "select", "multiselect", "boolean", "url"];

type DraftColumn = {
  label: string;
  field_type: TrackerFieldType;
  optionsText: string;
  source: TrackerFieldSource;
  source_path: string;
  required: boolean;
};

const emptyColumn = (defaultPath: string): DraftColumn => ({
  label: "",
  field_type: "text",
  optionsText: "",
  source: "input",
  source_path: defaultPath,
  required: false,
});

function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
}
function prettyState(s: string | null): string {
  if (!s) return "";
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export function TrackerBuilder({ canAuthor }: { canAuthor: boolean }) {
  const invalidate = useInvalidate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<TrackerTargetType>("fellow");
  const [completionStyle, setCompletionStyle] = useState<TrackerCompletionStyle>("checklist");
  const [statusesText, setStatusesText] = useState("");
  const [doneStatus, setDoneStatus] = useState("");
  const [deadline, setDeadline] = useState("");
  const [recurrence, setRecurrence] = useState<"" | TrackerRecurrence>("");
  const [columns, setColumns] = useState<DraftColumn[]>([emptyColumn(FELLOW_PATHS[0])]);
  const [stateFilter, setStateFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const profilePaths = pathsFor(targetType);
  const sources = sourcesFor(targetType);
  const assignable = useTrackerAssignable(targetType, canAuthor);
  const targetWord = targetType === "school" ? "schools" : "fellows";

  const states = useMemo(() => {
    const set = new Set((assignable.data ?? []).map((t) => t.state).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [assignable.data]);
  const visibleTargets = useMemo(
    () => (assignable.data ?? []).filter((t) => !stateFilter || t.state === stateFilter),
    [assignable.data, stateFilter],
  );

  if (!canAuthor) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
        <p className="text-sm font-medium text-red-800">Creating tasks needs manager access.</p>
      </div>
    );
  }

  const setColumn = (i: number, patch: Partial<DraftColumn>) =>
    setColumns((cols) => cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  function onTargetChange(next: TrackerTargetType) {
    setTargetType(next);
    setSelectedIds(new Set());
    setStateFilter("");
    const validPaths = pathsFor(next);
    const validSources = sourcesFor(next);
    setColumns((cols) =>
      cols.map((c) => {
        const source = validSources.includes(c.source) ? c.source : "input";
        const source_path = source === "profile" && !validPaths.includes(c.source_path) ? validPaths[0] : c.source_path;
        return { ...c, source, source_path };
      }),
    );
  }

  function toggleTarget(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const statuses = statusesText.split(",").map((s) => s.trim()).filter(Boolean);
      if (completionStyle === "workflow") {
        if (statuses.length === 0) throw new Error("Add at least one step.");
        if (!statuses.includes(doneStatus.trim())) throw new Error("The 'done' step must be one of the steps.");
      }

      const used = new Set<string>();
      const fields: TrackerField[] = columns
        .filter((c) => c.label.trim())
        .map((c, idx) => {
          let key = slug(c.label);
          let n = 2;
          while (used.has(key)) key = `${slug(c.label)}_${n++}`;
          used.add(key);
          return {
            field_key: key,
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
          };
        });
      for (const f of fields) {
        if ((f.field_type === "select" || f.field_type === "multiselect") && (!f.options || f.options.length === 0))
          throw new Error(`"${f.label}" needs at least one choice.`);
      }

      const { id } = await createTrackerTemplate({
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        target_type: targetType,
        completion_style: completionStyle,
        workflow_statuses: completionStyle === "workflow" ? statuses : undefined,
        done_status: completionStyle === "workflow" ? doneStatus.trim() : undefined,
        deadline: deadline || undefined,
        recurrence_frequency: recurrence || undefined,
      });
      if (fields.length > 0) await addTrackerFields(id, { fields });

      const targetIds = Array.from(selectedIds);
      let assigned = 0;
      if (targetIds.length > 0) assigned = (await assignTrackerTargets(id, targetIds)).created;

      await invalidate("tracker");
      setResult(`Created "${name.trim()}"` + (assigned ? ` and assigned to ${assigned} ${targetWord}.` : "."));
      setCode(""); setName(""); setDescription(""); setStatusesText(""); setDoneStatus(""); setDeadline(""); setRecurrence("");
      setColumns([emptyColumn(profilePaths[0] ?? "")]);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task.");
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
          Short code
          <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="MONTHLY-REPORT" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Task name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly Report" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Who does this task?
          <select value={targetType} onChange={(e) => onTargetChange(e.target.value as TrackerTargetType)} className={inputClass}>
            <option value="fellow">Each fellow</option>
            <option value="school">Each school</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Due date
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Repeats
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as "" | TrackerRecurrence)} className={inputClass}>
            <option value="">One-time</option>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          How is it completed?
          <select value={completionStyle} onChange={(e) => setCompletionStyle(e.target.value as TrackerCompletionStyle)} className={inputClass}>
            <option value="checklist">Tick when done</option>
            <option value="workflow">Move through steps</option>
          </select>
        </label>
        {completionStyle === "workflow" && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Steps (comma-separated)
              <input value={statusesText} onChange={(e) => setStatusesText(e.target.value)} placeholder="applied, paid, done" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Which step means done?
              <input value={doneStatus} onChange={(e) => setDoneStatus(e.target.value)} placeholder="done" className={inputClass} />
            </label>
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-950">What to fill in</h3>
          <button type="button" onClick={() => setColumns((c) => [...c, emptyColumn(profilePaths[0] ?? "")])} className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add field
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">Optional. Leave empty for a simple tick-when-done task.</p>
        <div className="flex flex-col gap-3">
          {columns.map((col, i) => (
            <div key={i} className="grid items-end gap-2 rounded-md border border-gray-100 bg-gray-50/60 p-3 md:grid-cols-5">
              <input value={col.label} onChange={(e) => setColumn(i, { label: e.target.value })} placeholder="Field label" className={inputClass} />
              <select value={col.field_type} onChange={(e) => setColumn(i, { field_type: e.target.value as TrackerFieldType })} className={inputClass}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={col.source} onChange={(e) => setColumn(i, { source: e.target.value as TrackerFieldSource })} className={inputClass}>
                {sources.map((s) => <option key={s} value={s}>{s === "profile" ? "Auto-filled" : "You enter"}</option>)}
              </select>
              {col.source === "profile" ? (
                <select value={col.source_path} onChange={(e) => setColumn(i, { source_path: e.target.value })} className={inputClass}>
                  {profilePaths.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (col.field_type === "select" || col.field_type === "multiselect") ? (
                <input value={col.optionsText} onChange={(e) => setColumn(i, { optionsText: e.target.value })} placeholder="choices: a, b" className={inputClass} />
              ) : (
                <div />
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <input type="checkbox" checked={col.required} onChange={(e) => setColumn(i, { required: e.target.checked })} /> Required
                </label>
                <button type="button" onClick={() => setColumns((c) => c.filter((_, idx) => idx !== i))} aria-label="Remove field" className="text-gray-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-950">Assign to {targetWord}</h3>
          {states.length > 1 && (
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500">
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{prettyState(s)}</option>)}
            </select>
          )}
        </div>
        {assignable.isLoading ? (
          <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
        ) : visibleTargets.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No {targetWord} in your scope.</p>
        ) : (
          <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
            {visibleTargets.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleTarget(t.id)} />
                <span className="text-gray-900">{t.name}</span>
                {t.state && <span className="text-xs text-gray-400">{prettyState(t.state)}</span>}
              </label>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">{selectedIds.size} selected. Leave empty to assign later.</p>
      </section>

      {error && <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {result && <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>}

      <div>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Create task
        </button>
      </div>
    </form>
  );
}
