"use client";

import { useState } from "react";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { useTrackerTaskSummary } from "@/lib/queries/tracker";
import type { TrackerTaskSummaryFilters, TrackerTaskSummaryRow } from "@/lib/tracker-api";
import { TASK_STATE_META, TASK_STATE_ORDER, type StateCounts, type TaskState } from "@/lib/tracker-status";
import { StatusCards } from "./status-cards";

const selCls = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500";
const ZERO_COUNTS: StateCounts = { done: 0, pending: 0, blocked: 0, overdue: 0 };

/** Task-first list: one row per task with its overall completion. Clicking a task drills the
 *  org tree (ZM → fellow → school → student) scoped to that task. */
export function AllTasksPanel({ onOpenDrill }: { onOpenDrill: (task: TrackerTaskSummaryRow) => void }) {
  const [f, setF] = useState<TrackerTaskSummaryFilters>({ page: 1, limit: 50 });
  const set = (patch: Partial<TrackerTaskSummaryFilters>) => setF((p) => ({ ...p, page: 1, ...patch }));
  const { data, isLoading, error } = useTrackerTaskSummary(f);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const limit = f.limit ?? 50;
  const page = f.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const stateCounts = data?.stateCounts ?? ZERO_COUNTS;

  return (
    <div className="flex flex-col gap-3">
      <StatusCards
        counts={stateCounts}
        activeState={(f.status ?? null) as TaskState | null}
        onSelect={(s) => set({ status: f.status === s ? undefined : s })}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={f.q ?? ""} onChange={(e) => set({ q: e.target.value })}
          placeholder="Search tasks…" className={selCls + " w-56"} />
        <select value={f.priority ?? ""} onChange={(e) => set({ priority: (e.target.value || undefined) as TrackerTaskSummaryFilters["priority"] })} className={selCls}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={f.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as TrackerTaskSummaryFilters["status"] })} className={selCls}>
          <option value="">All statuses</option>
          {TASK_STATE_ORDER.map((s) => <option key={s} value={s}>{TASK_STATE_META[s].label}</option>)}
        </select>
      </div>

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
                  <th className="px-4 py-3 font-semibold">Assigned to</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Progress</th>
                  <th className="px-4 py-3 font-semibold">People</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.template_id}
                    onClick={() => onOpenDrill(r)}
                    className="cursor-pointer border-t border-gray-100 transition-colors hover:bg-teal-50/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-950">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{TARGET_LABEL[r.target_type]}</td>
                    <td className="px-4 py-3 capitalize text-gray-600">{r.priority}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <ProgressBar done={r.done} total={r.total} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.total}</td>
                    <td className="px-4 py-3"><StatePill state={r.rolled_state} /></td>
                    <td className="px-4 py-3 text-gray-600">{r.deadline ? formatDate(r.deadline) : "—"}</td>
                    <td className="px-4 py-3"><ChevronRight className="ml-auto h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" /></td>
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

const TARGET_LABEL: Record<TrackerTaskSummaryRow["target_type"], string> = {
  student: "Students",
  school: "Schools",
  fellow: "Staff",
};

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs text-gray-600">{done}/{total} done</span>
    </div>
  );
}

function StatePill({ state }: { state: TaskState }) {
  const meta = TASK_STATE_META[state];
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }[meta.tone];
  return <span className={`inline-flex w-20 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{meta.label}</span>;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
