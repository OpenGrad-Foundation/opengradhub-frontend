"use client";

import { useRef, useState, type FormEvent } from "react";
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
  type TrackerPriority,
  profilePathLabel,
} from "@/lib/tracker-api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { AudiencePicker } from "./audience-picker";

// Mirrors the backend PROFILE_ALLOWLIST (src/tracker/tracker.constants.ts), per target type.
const FELLOW_PATHS = ["fellow.name", "fellow.email"] as const;
const STUDENT_PATHS = ["student.name", "student.category", "student.district", "student.contact", "school.name", "school.code"] as const;
const SCHOOL_PATHS: readonly string[] = []; // school projection not wired yet
const pathsFor = (t: TrackerTargetType): readonly string[] =>
  t === "fellow" ? FELLOW_PATHS : t === "student" ? STUDENT_PATHS : SCHOOL_PATHS;
const sourcesFor = (t: TrackerTargetType): TrackerFieldSource[] =>
  pathsFor(t).length ? ["input", "profile"] : ["input"];

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<TrackerTargetType>("fellow");
  const [completionStyle, setCompletionStyle] = useState<TrackerCompletionStyle>("checklist");
  const [statusesText, setStatusesText] = useState("");
  const [doneStatus, setDoneStatus] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<TrackerPriority>("medium");
  const [recurrence, setRecurrence] = useState<"" | TrackerRecurrence>("");
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireLocation, setRequireLocation] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [columns, setColumns] = useState<DraftColumn[]>([emptyColumn(FELLOW_PATHS[0])]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const submittingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const profilePaths = pathsFor(targetType);
  const sources = sourcesFor(targetType);
  const targetWord = targetType === "school" ? "schools" : targetType === "student" ? "students" : "staff";

  if (!canAuthor) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
        <p className="text-sm font-medium text-red-800">Creating tasks needs manager access.</p>
      </div>
    );
  }

  const setColumn = (i: number, patch: Partial<DraftColumn>) =>
    setColumns((cols) => cols.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  // Flipping a field to "Auto-filled" must land on a path valid for the current target —
  // otherwise the select shows the first option but state keeps a stale path (e.g. fellow.name
  // on a student task), which the backend rejects via the allow-list on submit.
  function onSourceChange(i: number, source: TrackerFieldSource) {
    setColumn(i, {
      source,
      ...(source === "profile" && !profilePaths.includes(columns[i]?.source_path ?? "")
        ? { source_path: profilePaths[0] ?? "" }
        : {}),
    });
  }

  function onTargetChange(next: TrackerTargetType) {
    setTargetType(next);
    setSelectedIds(new Set());
    const validPaths = pathsFor(next);
    const validSources = sourcesFor(next);
    setColumns((cols) =>
      cols.map((c) => {
        const source = validSources.includes(c.source) ? c.source : "input";
        // Always re-anchor to a valid path so a stale path can't survive a target switch.
        const source_path = validPaths.length && !validPaths.includes(c.source_path) ? validPaths[0] : c.source_path;
        return { ...c, source, source_path };
      }),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return; // guard: async setBusy can't stop a fast double-click
    submittingRef.current = true;
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
            // Coerce to a target-valid path (matches what the dropdown displays) so a stale
            // path never reaches the backend allow-list.
            source_path:
              c.source === "profile"
                ? profilePaths.includes(c.source_path) ? c.source_path : profilePaths[0] ?? null
                : null,
            required: c.required,
            visible_if: null,
            sort_order: idx,
          };
        });
      for (const f of fields) {
        if ((f.field_type === "select" || f.field_type === "multiselect") && (!f.options || f.options.length === 0))
          throw new Error(`"${f.label}" needs at least one choice.`);
      }

      // Code is an internal unique key — auto-derived from the name so authors only type a name.
      const autoCode = `${slug(name)}-${Date.now().toString(36)}`.toUpperCase();
      const { id } = await createTrackerTemplate({
        code: autoCode,
        name: name.trim(),
        description: description.trim() || undefined,
        target_type: targetType,
        completion_style: completionStyle,
        workflow_statuses: completionStyle === "workflow" ? statuses : undefined,
        done_status: completionStyle === "workflow" ? doneStatus.trim() : undefined,
        deadline: deadline || undefined,
        priority,
        recurrence_frequency: recurrence || undefined,
        require_photo: requirePhoto,
        require_location: requireLocation,
        status: saveAsDraft ? "draft" : "active",
      });
      if (fields.length > 0) await addTrackerFields(id, { fields });

      const targetIds = Array.from(selectedIds);
      let assigned = 0;
      if (targetIds.length > 0) assigned = (await assignTrackerTargets(id, targetIds)).created;

      await invalidate("tracker");
      const visibility = saveAsDraft ? " Saved as a draft — publish it to make it visible." : "";
      setResult(`Created "${name.trim()}"` + (assigned ? ` and assigned to ${assigned} ${targetWord}.` : ".") + visibility);
      setName(""); setDescription(""); setStatusesText(""); setDoneStatus(""); setDeadline(""); setPriority("medium"); setRecurrence("");
      setRequirePhoto(false); setRequireLocation(false); setSaveAsDraft(false);
      setColumns([emptyColumn(profilePaths[0] ?? "")]);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const inputClass =
    "h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
  const filterClass =
    "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
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
            <option value="fellow">Each staff member</option>
            <option value="school">Each school</option>
            <option value="student">Each student</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Due date
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as TrackerPriority)} className={inputClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
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
        <div className="flex flex-col gap-2 sm:col-span-2">
          <span className="text-sm font-medium text-gray-700">Proof of visit</span>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={requirePhoto} onChange={(e) => setRequirePhoto(e.target.checked)} />
            Require a photo before it can be marked done
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={requireLocation} onChange={(e) => setRequireLocation(e.target.checked)} />
            Require capturing location before it can be marked done
          </label>
        </div>
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
              <select value={col.source} onChange={(e) => onSourceChange(i, e.target.value as TrackerFieldSource)} className={inputClass}>
                {sources.map((s) => <option key={s} value={s}>{s === "profile" ? "Auto-filled" : "You enter"}</option>)}
              </select>
              {col.source === "profile" ? (
                <select value={col.source_path} onChange={(e) => setColumn(i, { source_path: e.target.value })} className={inputClass}>
                  {profilePaths.map((p) => <option key={p} value={p}>{profilePathLabel(p)}</option>)}
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
        <h3 className="mb-1 text-sm font-semibold text-gray-950">Assign to {targetWord}</h3>
        <AudiencePicker key={targetType} targetType={targetType} canAuthor={canAuthor} selected={selectedIds} onChange={setSelectedIds} />
        <p className="mt-2 text-xs text-gray-500">Leave empty to assign later.</p>
      </section>

      {error && <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {result && <p className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saveAsDraft ? "Save draft" : "Create & publish"}
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={saveAsDraft} onChange={(e) => setSaveAsDraft(e.target.checked)} />
          Save as draft (hidden from fellows until published)
        </label>
      </div>
    </form>
  );
}
