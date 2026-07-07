"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTrackerAllTasks, useTrackerZms } from "@/lib/queries/tracker";
import type { TrackerAllTasksFilters, TrackerAllTaskRow } from "@/lib/tracker-api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { NudgeButton } from "./nudge-button";

const LIFECYCLE_LABEL: Record<string, string> = {
  done: "Done", blocked: "Stuck", overdue: "Overdue",
  in_progress: "In progress", not_started: "To do",
};
const selCls = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500";

export function AllTasksPanel() {
  const [f, setF] = useState<TrackerAllTasksFilters>({ page: 1, limit: 50 });
  const set = (patch: Partial<TrackerAllTasksFilters>) => setF((p) => ({ ...p, page: 1, ...patch }));
  const { data: zms = [] } = useTrackerZms();
  const { data, isLoading, error } = useTrackerAllTasks(f);
  const canNudge = usePermissions().has(PERM.tracker.author);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const limit = f.limit ?? 50;
  const page = f.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={f.q ?? ""} onChange={(e) => set({ q: e.target.value })}
          placeholder="Search task, doer, school…" className={selCls + " w-56"} />
        <select value={f.doerType ?? ""} onChange={(e) => set({ doerType: (e.target.value || undefined) as TrackerAllTasksFilters["doerType"] })} className={selCls}>
          <option value="">All doers</option>
          <option value="zm">Zonal Managers</option>
          <option value="fellow">Fellows</option>
        </select>
        <select value={f.zmId ?? ""} onChange={(e) => set({ zmId: e.target.value || undefined })} className={selCls}>
          <option value="">All ZMs</option>
          {zms.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <select value={f.priority ?? ""} onChange={(e) => set({ priority: (e.target.value || undefined) as TrackerAllTasksFilters["priority"] })} className={selCls}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={f.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as TrackerAllTasksFilters["status"] })} className={selCls}>
          <option value="">All statuses</option>
          <option value="not_started">To do</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Stuck</option>
          <option value="overdue">Overdue</option>
          <option value="done">Done</option>
        </select>
        <input value={f.state ?? ""} onChange={(e) => set({ state: e.target.value || undefined })} placeholder="State" className={selCls + " w-28"} />
        <input value={f.district ?? ""} onChange={(e) => set({ district: e.target.value || undefined })} placeholder="District" className={selCls + " w-28"} />
        <select value={f.groupBy ?? ""} onChange={(e) => set({ groupBy: (e.target.value || undefined) as TrackerAllTasksFilters["groupBy"] })} className={selCls + " ml-auto"}>
          <option value="">Group: none</option>
          <option value="zm">Group by ZM</option>
          <option value="fellow">Group by fellow</option>
        </select>
      </div>

      {data?.groupCounts && data.groupCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.groupCounts.map((g) => (
            <span key={g.key} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700">
              {g.label} <span className="font-semibold text-gray-950">{g.count}</span>
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
      ) : error ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
          <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
          <p className="text-sm font-medium text-red-800">{error instanceof Error ? error.message : "Failed to load tasks."}</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">No tasks match these filters.</p>
      ) : (
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Doer</th>
                  <th className="px-4 py-3 font-semibold">ZM</th>
                  <th className="px-4 py-3 font-semibold">State</th>
                  <th className="px-4 py-3 font-semibold">District</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  {canNudge && <th className="px-4 py-3 font-semibold" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r: TrackerAllTaskRow) => (
                  <tr key={r.record_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-950">{r.task_name}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.doer_name ?? "—"}
                      {r.doer_role === "ZONAL_MANAGER" && <span className="ml-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">ZM</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.zm_name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{prettyState(r.state)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.district ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{r.priority}</td>
                    <td className="px-4 py-3 text-gray-700">{LIFECYCLE_LABEL[r.lifecycle] ?? r.lifecycle}</td>
                    <td className="px-4 py-3 text-gray-600">{r.deadline ? formatDate(r.deadline) : "—"}</td>
                    {canNudge && (
                      <td className="px-4 py-3">
                        {r.doer_id && r.lifecycle !== "done" && <NudgeButton doerId={r.doer_id} templateId={r.template_id} lastNudgedAt={r.last_nudged_at} />}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{total} task{total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setF((p) => ({ ...p, page: (p.page ?? 1) - 1 }))} className="rounded-md border border-gray-300 px-2.5 py-1 disabled:opacity-40">Prev</button>
          <span>Page {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setF((p) => ({ ...p, page: (p.page ?? 1) + 1 }))} className="rounded-md border border-gray-300 px-2.5 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

function prettyState(s: string | null): string {
  if (!s) return "—";
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}
function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
