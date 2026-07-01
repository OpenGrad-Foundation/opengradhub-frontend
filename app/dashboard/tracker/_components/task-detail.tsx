"use client";

import { AlertCircle, ArrowLeft, Loader2, Table2 } from "lucide-react";
import { useTrackerTemplate } from "@/lib/queries/tracker";
import type { TrackerField, TrackerTemplate } from "@/lib/tracker-api";

const TARGET_LABEL: Record<string, string> = {
  student: "One row per student",
  fellow: "One task per fellow",
  school: "One task per school",
};

export function TaskDetail({
  template,
  onBack,
  onOpenGrid,
}: {
  template: TrackerTemplate;
  onBack: () => void;
  onOpenGrid?: () => void;
}) {
  const { data, isLoading, error } = useTrackerTemplate(template.id);
  const fields = data?.fields ?? [];

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tasks
        </button>
        {onOpenGrid && (
          <button type="button" onClick={onOpenGrid} className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
            <Table2 className="h-4 w-4" aria-hidden="true" /> Open task
          </button>
        )}
      </div>

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
              <li key={f.field_key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-950">
                    {f.label}
                    {f.required && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-600">Required</span>}
                  </p>
                  {fieldHint(f) && <p className="mt-0.5 text-xs text-gray-500">{fieldHint(f)}</p>}
                </div>
                {f.source === "profile"
                  ? <StatusPill label="Auto-filled" tone="amber" />
                  : <StatusPill label="You enter" tone="gray" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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
