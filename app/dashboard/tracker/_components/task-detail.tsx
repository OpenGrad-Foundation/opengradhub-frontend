"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Table2, Trash2 } from "lucide-react";
import { useDeleteTrackerField, useTrackerTemplate, useUpdateTrackerTemplate } from "@/lib/queries/tracker";
import type { TrackerField, TrackerRecurrence, TrackerTemplate } from "@/lib/tracker-api";

const TARGET_LABEL: Record<string, string> = {
  student: "One row per student",
  fellow: "One task per fellow",
  school: "One task per school",
};

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

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tasks
        </button>
        <div className="flex items-center gap-2">
          {canAuthor && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
            </button>
          )}
          {onOpenGrid && (
            <button type="button" onClick={onOpenGrid} className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
              <Table2 className="h-4 w-4" aria-hidden="true" /> Open task
            </button>
          )}
        </div>
      </div>

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
            <Meta label="Repeats" value={template.recurrence_frequency ? `Every ${template.recurrence_frequency.replace(/ly$/, "")}` : "One-time"} />
            {template.completion_style === "workflow" && (
              <Meta label="Steps" value={(template.workflow_statuses ?? []).join("  →  ")} wide />
            )}
          </dl>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-950">What you fill in</h3>
          <p className="mt-0.5 text-xs text-gray-500">Some details are filled in for you automatically.</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
        ) : error ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-red-700"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error instanceof Error ? error.message : "Failed to load."}</p>
        ) : fields.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">Nothing to fill in — just mark it done.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {fields.map((f) => (
              <FieldRow key={f.field_key} templateId={template.id} field={f} editing={editing} />
            ))}
          </ul>
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

function EditTemplate({ template, onDone }: { template: TrackerTemplate; onDone: () => void }) {
  const update = useUpdateTrackerTemplate(template.id);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [deadline, setDeadline] = useState(template.deadline ? template.deadline.slice(0, 10) : "");
  const [status, setStatus] = useState<TrackerTemplate["status"]>(template.status);
  const [recurrence, setRecurrence] = useState<"" | TrackerRecurrence>((template.recurrence_frequency as TrackerRecurrence) ?? "");
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
