"use client";

import { AlertCircle, ArrowLeft, Loader2, Table2 } from "lucide-react";
import { useTrackerTemplate } from "@/lib/queries/tracker";
import type { TrackerField, TrackerTemplate } from "@/lib/tracker-api";

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
          <button type="button" onClick={onOpenGrid} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Table2 className="h-4 w-4" aria-hidden="true" /> Open grid
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-950">{template.name}</h2>
          <StatusPill label={template.status} tone={template.status === "active" ? "green" : "gray"} />
          <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{template.code}</code>
        </div>
        {template.description && <p className="mt-2 text-sm text-gray-600">{template.description}</p>}

        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Target" value={template.target_type} />
          <Meta label="Completion" value={template.completion_style} />
          <Meta label="Deadline" value={template.deadline ?? "—"} />
          <Meta label="Recurrence" value={template.recurrence_frequency ?? "One-shot"} />
          {template.completion_style === "workflow" && (
            <Meta label="Statuses" value={`${(template.workflow_statuses ?? []).join(" → ")}  (done: ${template.done_status})`} wide />
          )}
        </dl>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-950">Columns</h3>
        </div>
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
        ) : error ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-red-700"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error instanceof Error ? error.message : "Failed to load columns."}</p>
        ) : fields.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No columns defined.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Label</th>
                  <th className="px-4 py-3 font-semibold">Key</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold">Req</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.field_key} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-950">{f.label}</td>
                    <td className="px-4 py-3 text-gray-600"><code className="text-xs">{f.field_key}</code></td>
                    <td className="px-4 py-3 text-gray-700">{f.field_type}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={f.source} tone={f.source === "profile" ? "amber" : "gray"} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fieldDetail(f)}</td>
                    <td className="px-4 py-3 text-gray-700">{f.required ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function fieldDetail(f: TrackerField): string {
  const parts: string[] = [];
  if (f.source === "profile" && f.source_path) parts.push(`from ${f.source_path}`);
  if ((f.field_type === "select" || f.field_type === "multiselect") && f.options?.length) parts.push(`options: ${f.options.join(", ")}`);
  if (f.visible_if) parts.push(`shown if ${f.visible_if.field} ${f.visible_if.op}${f.visible_if.value !== undefined ? ` ${JSON.stringify(f.visible_if.value)}` : ""}`);
  return parts.join(" · ") || "—";
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm capitalize text-gray-900">{value}</dd>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "gray" | "amber" }) {
  const toneClass = { green: "bg-emerald-50 text-emerald-700", gray: "bg-gray-100 text-gray-700", amber: "bg-amber-50 text-amber-700" }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${toneClass}`}>{label}</span>;
}
