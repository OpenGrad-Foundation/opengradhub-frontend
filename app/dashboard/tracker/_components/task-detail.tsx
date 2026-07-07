"use client";

import { useState } from "react";
import { AlertCircle, Archive, ArchiveRestore, ArrowLeft, Loader2, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { useAddTrackerFields, useDeleteTrackerField, useDeleteTrackerTemplate, useTrackerSummary, useTrackerTemplate, useUpdateTrackerTemplate } from "@/lib/queries/tracker";
import { assignTrackerTargets, profilePathLabel, type TrackerField, type TrackerFieldSource, type TrackerFieldType, type TrackerRecurrence, type TrackerTargetType, type TrackerTemplate } from "@/lib/tracker-api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { AudiencePicker } from "./audience-picker";

const TARGET_LABEL: Record<string, string> = {
  student: "One row per student",
  fellow: "One task per staff member",
  school: "One task per school",
};

// Mirrors the backend PROFILE_ALLOWLIST + the builder, so fields added here match new-task fields.
const FELLOW_PATHS = ["fellow.name", "fellow.email"];
const STUDENT_PATHS = ["student.name", "student.category", "student.district", "student.contact", "school.name", "school.code"];
const pathsFor = (t: TrackerTargetType): string[] => (t === "fellow" ? FELLOW_PATHS : t === "student" ? STUDENT_PATHS : []);
const sourcesFor = (t: TrackerTargetType): TrackerFieldSource[] => (pathsFor(t).length ? ["input", "profile"] : ["input"]);
const FIELD_TYPES: TrackerFieldType[] = ["text", "number", "date", "select", "multiselect", "boolean", "url"];

function slugKey(label: string, used: Set<string>): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (used.has(key)) key = `${base}_${n++}`;
  return key;
}

export function TaskDetail({
  template,
  canAuthor,
  onBack,
  onOpenGrid,
}: {
  template: TrackerTemplate;
  canAuthor: boolean;
  onBack: () => void;
  onOpenGrid?: () => void;
}) {
  const { data, isLoading, error } = useTrackerTemplate(template.id);
  const fields = data?.fields ?? [];
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useDeleteTrackerTemplate();
  const archive = useUpdateTrackerTemplate(template.id);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isArchived = template.status === "archived";

  async function onDelete() {
    try {
      await del.mutateAsync(template.id);
      onBack();
    } catch {
      /* mutation error surfaced below via del.isError */
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tasks
        </button>
        <div className="flex items-center gap-2">
          {canAuthor && !editing && (
            <>
              {isArchived ? (
                <button type="button" onClick={async () => { try { await archive.mutateAsync({ status: "active" }); onBack(); } catch { /* surfaced via archive.isError */ } }} disabled={archive.isPending} className="inline-flex items-center gap-1.5 rounded-md border border-teal-300 px-3 py-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60">
                  {archive.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArchiveRestore className="h-4 w-4" aria-hidden="true" />} Restore
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmArchive(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Archive className="h-4 w-4" aria-hidden="true" /> Mark done &amp; archive
                </button>
              )}
              <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
              </button>
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </button>
            </>
          )}
          {onOpenGrid && (
            <button type="button" onClick={onOpenGrid} className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
              <Table2 className="h-4 w-4" aria-hidden="true" /> Open task
            </button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <div>
            <p className="text-sm font-semibold text-red-900">Delete “{template.name}”?</p>
            <p className="mt-1 text-sm text-red-800">This permanently removes the task and every assigned row, filled value, blocker, and history entry. This can’t be undone.</p>
          </div>
          {del.isError && <p className="text-sm text-red-700">{del.error instanceof Error ? del.error.message : "Could not delete."}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onDelete} disabled={del.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {del.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Delete permanently
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} disabled={del.isPending} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          </div>
        </div>
      )}

      {confirmArchive && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-900">Archive “{template.name}”?</p>
            <p className="mt-1 text-sm text-amber-800">It leaves the active task list and stops generating new recurring rows. All existing data and history are kept, and you can restore it anytime.</p>
          </div>
          {archive.isError && <p className="text-sm text-red-700">{archive.error instanceof Error ? archive.error.message : "Could not archive."}</p>}
          <div className="flex items-center gap-2">
            <button type="button" disabled={archive.isPending} onClick={async () => { try { await archive.mutateAsync({ status: "archived" }); setConfirmArchive(false); onBack(); } catch { /* surfaced above */ } }} className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
              {archive.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Archive
            </button>
            <button type="button" onClick={() => setConfirmArchive(false)} disabled={archive.isPending} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancel</button>
          </div>
        </div>
      )}

      {editing ? (
        <EditTemplate template={template} onDone={() => setEditing(false)} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-950">{template.name}</h2>
            <StatusPill label={template.status === "active" ? "Active" : template.status} tone={template.status === "active" ? "green" : "gray"} />
          </div>
          {template.description && <p className="mt-2 text-sm text-gray-600">{template.description}</p>}
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="Applies to" value={TARGET_LABEL[template.target_type] ?? template.target_type} />
            <Meta label="How it's completed" value={template.completion_style === "workflow" ? "Move through steps" : "Tick when done"} />
            <Meta label="Due by" value={template.deadline ? formatDate(template.deadline) : "No deadline"} />
            <Meta label="Priority" value={template.priority.charAt(0).toUpperCase() + template.priority.slice(1)} />
            <Meta label="Repeats" value={template.recurrence_frequency ? `Every ${template.recurrence_frequency.replace(/ly$/, "")}` : "One-time"} />
            {template.completion_style === "workflow" && (
              <Meta label="Steps" value={(template.workflow_statuses ?? []).join("  →  ")} wide />
            )}
            {(template.require_photo || template.require_location) && (
              <Meta label="Proof of visit" value={[template.require_photo ? "Photo" : null, template.require_location ? "Location" : null].filter(Boolean).join(" + ")} />
            )}
          </dl>
        </div>
      )}

      {canAuthor && !editing && <TaskSummary templateId={template.id} targetType={template.target_type} />}

      {canAuthor && !editing && <AssignSection template={template} canAuthor={canAuthor} />}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-950">Fields in this task</h3>
          <p className="mt-0.5 text-xs text-gray-500">The columns this task collects. The assignee fills these in on the task itself; “Auto-filled” ones come from the record.</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
        ) : error ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-red-700"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error instanceof Error ? error.message : "Failed to load."}</p>
        ) : fields.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No fields — this is a simple tick-when-done task.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {fields.map((f) => (
              <FieldRow key={f.field_key} templateId={template.id} field={f} editing={editing} />
            ))}
          </ul>
        )}
        {editing && (
          <AddFieldForm
            templateId={template.id}
            targetType={template.target_type}
            usedKeys={fields.map((f) => f.field_key)}
            nextSort={fields.length}
          />
        )}
      </div>
    </section>
  );
}

function FieldRow({ templateId, field: f, editing }: { templateId: string; field: TrackerField; editing: boolean }) {
  const del = useDeleteTrackerField(templateId);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-950">
          {f.label}
          {f.required && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">Required</span>}
        </p>
        {fieldHint(f) && <p className="mt-0.5 text-xs text-gray-500">{fieldHint(f)}</p>}
      </div>
      <div className="flex items-center gap-2">
        {f.source === "profile" ? <StatusPill label="Auto-filled" tone="amber" /> : <StatusPill label="You enter" tone="gray" />}
        {editing && f.id && (
          <button type="button" onClick={() => del.mutate(f.id!)} disabled={del.isPending} aria-label="Remove field" className="text-gray-400 hover:text-red-600 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </li>
  );
}

const TARGET_PLURAL: Record<string, string> = { student: "students", school: "schools", fellow: "staff" };

function AssignSection({ template, canAuthor }: { template: TrackerTemplate; canAuthor: boolean }) {
  const invalidate = useInvalidate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const word = TARGET_PLURAL[template.target_type] ?? "targets";

  async function assign() {
    if (selected.size === 0) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const { created } = await assignTrackerTargets(template.id, Array.from(selected));
      await invalidate("tracker");
      setResult(`Assigned to ${created} ${word}.`);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-1 text-base font-semibold text-gray-950">Assign to more {word}</h3>
      <AudiencePicker targetType={template.target_type} canAuthor={canAuthor} selected={selected} onChange={setSelected} />
      {error && <p className="mt-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {result && <p className="mt-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>}
      <div className="mt-3">
        <button type="button" onClick={assign} disabled={busy || selected.size === 0} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Assign to {selected.size} {word}
        </button>
      </div>
    </div>
  );
}

function TaskSummary({ templateId, targetType }: { templateId: string; targetType: TrackerTargetType }) {
  const { data: rows = [], isLoading } = useTrackerSummary(templateId);
  // For a user-doer (fellow) task the row IS the assignee (a fellow or a delegated manager);
  // for student/school tasks the row is the fellow who owns that school.
  const ownerHeader = targetType === "fellow" ? "Staff member" : "Fellow";
  const totals = rows.reduce(
    (a, r) => ({ done: a.done + r.done, pending: a.pending + r.pending, blocked: a.blocked + r.blocked, overdue: a.overdue + r.overdue }),
    { done: 0, pending: 0, blocked: 0, overdue: 0 },
  );
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-base font-semibold text-gray-950">Progress</h3>
        <p className="mt-0.5 text-xs text-gray-500">How your team is doing on this task.</p>
      </div>
      {isLoading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
      ) : (
        <div className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryMetric label="Done" value={totals.done} tone="text-emerald-700" />
            <SummaryMetric label="Pending" value={totals.pending} tone="text-gray-700" />
            <SummaryMetric label="Blocked" value={totals.blocked} tone="text-red-700" />
            <SummaryMetric label="Overdue" value={totals.overdue} tone="text-amber-700" />
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-500">No one assigned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{ownerHeader}</th>
                    <th className="px-3 py-2 font-semibold">Done</th>
                    <th className="px-3 py-2 font-semibold">Pending</th>
                    <th className="px-3 py-2 font-semibold">Blocked</th>
                    <th className="px-3 py-2 font-semibold">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.fellow_id ?? "unassigned"} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-950">{r.fellow_name ?? r.fellow_id ?? "Unassigned"}</td>
                      <td className="px-3 py-2 text-gray-700">{r.done}</td>
                      <td className="px-3 py-2 text-gray-700">{r.pending}</td>
                      <td className="px-3 py-2 text-gray-700">{r.blocked}</td>
                      <td className="px-3 py-2 text-gray-700">{r.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function AddFieldForm({
  templateId,
  targetType,
  usedKeys,
  nextSort,
}: {
  templateId: string;
  targetType: TrackerTargetType;
  usedKeys: string[];
  nextSort: number;
}) {
  const add = useAddTrackerFields(templateId);
  const sources = sourcesFor(targetType);
  const paths = pathsFor(targetType);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<TrackerFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [source, setSource] = useState<TrackerFieldSource>("input");
  const [sourcePath, setSourcePath] = useState(paths[0] ?? "");
  const [required, setRequired] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inputClass = "h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  async function save() {
    setErr(null);
    if (!label.trim()) { setErr("Add a label."); return; }
    const isSelect = fieldType === "select" || fieldType === "multiselect";
    const options = isSelect ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : null;
    if (isSelect && (!options || options.length === 0)) { setErr("Add at least one choice."); return; }
    if (source === "profile" && !sourcePath) { setErr("Pick where it's filled from."); return; }
    const field: TrackerField = {
      field_key: slugKey(label, new Set(usedKeys)),
      label: label.trim(),
      field_type: fieldType,
      options,
      source,
      source_path: source === "profile" ? sourcePath : null,
      required,
      visible_if: null,
      sort_order: nextSort,
    };
    try {
      await add.mutateAsync({ fields: [field] });
      setLabel(""); setOptionsText(""); setRequired(false); setSource("input"); setFieldType("text"); setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add the field.");
    }
  }

  if (!open) {
    return (
      <div className="border-t border-gray-100 px-4 py-3">
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add field
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
      <div className="grid items-end gap-2 md:grid-cols-5">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Field label" className={inputClass} />
        <select value={fieldType} onChange={(e) => setFieldType(e.target.value as TrackerFieldType)} className={inputClass}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value as TrackerFieldSource)} className={inputClass}>
          {sources.map((s) => <option key={s} value={s}>{s === "profile" ? "Auto-filled" : "You enter"}</option>)}
        </select>
        {source === "profile" ? (
          <select value={sourcePath} onChange={(e) => setSourcePath(e.target.value)} className={inputClass}>
            {paths.map((p) => <option key={p} value={p}>{profilePathLabel(p)}</option>)}
          </select>
        ) : (fieldType === "select" || fieldType === "multiselect") ? (
          <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="choices: a, b" className={inputClass} />
        ) : (
          <div />
        )}
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
        </label>
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={save} disabled={add.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />} Add field
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function EditTemplate({ template, onDone }: { template: TrackerTemplate; onDone: () => void }) {
  const update = useUpdateTrackerTemplate(template.id);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [deadline, setDeadline] = useState(template.deadline ? template.deadline.slice(0, 10) : "");
  const [status, setStatus] = useState<TrackerTemplate["status"]>(template.status);
  const [recurrence, setRecurrence] = useState<"" | TrackerRecurrence>((template.recurrence_frequency as TrackerRecurrence) ?? "");
  const [requirePhoto, setRequirePhoto] = useState(template.require_photo);
  const [requireLocation, setRequireLocation] = useState(template.require_location);
  const [err, setErr] = useState<string | null>(null);

  const inputClass = "h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  async function save() {
    setErr(null);
    try {
      await update.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        deadline: deadline || null,
        status,
        recurrence_frequency: recurrence || null,
        require_photo: requirePhoto,
        require_location: requireLocation,
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-teal-200 bg-teal-50/40 p-5 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
        Task name
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
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
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as TrackerTemplate["status"])} className={inputClass}>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-medium text-gray-700">Proof of visit</span>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={requirePhoto} onChange={(e) => setRequirePhoto(e.target.checked)} />
          Require a photo
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={requireLocation} onChange={(e) => setRequireLocation(e.target.checked)} />
          Require location capture
        </label>
      </div>
      {err && <p className="text-sm text-red-700 sm:col-span-2">{err}</p>}
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="button" onClick={save} disabled={update.isPending} className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Save changes
        </button>
        <button type="button" onClick={onDone} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function fieldHint(f: TrackerField): string {
  if (f.source === "profile") return "Filled in automatically from the record.";
  if (f.field_type === "select" && f.options?.length) return `Choose one: ${f.options.join(", ")}`;
  if (f.field_type === "multiselect" && f.options?.length) return `Choose any: ${f.options.join(", ")}`;
  if (f.field_type === "date") return "Pick a date.";
  if (f.field_type === "url") return "Paste a link.";
  if (f.field_type === "boolean") return "Yes / No.";
  if (f.field_type === "number") return "Enter a number.";
  return "";
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "gray" | "amber" }) {
  const toneClass = { green: "bg-emerald-50 text-emerald-700", gray: "bg-gray-100 text-gray-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
