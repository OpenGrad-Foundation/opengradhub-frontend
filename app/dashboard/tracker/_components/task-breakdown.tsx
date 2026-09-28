"use client";

import { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Search, Table2 } from "lucide-react";
import { useTrackerTaskBreakdown } from "@/lib/queries/tracker";
import type { TrackerBreakdownRow, TrackerTaskSummaryRow } from "@/lib/tracker-api";
import { TASK_STATE_META, TASK_STATE_ORDER, type TaskState } from "@/lib/tracker-status";
import { IN_CHARGE_LOWER, IN_CHARGE_PLURAL } from "@/lib/labels";
import { NudgeButton } from "./nudge-button";

type PeopleLevel = "zm" | "fellow";
const LEVEL_LABEL: Record<PeopleLevel, string> = { zm: "Zonal Managers", fellow: IN_CHARGE_PLURAL };

/** Task-scoped people cascade: zonal managers expand in place to their in-charges, and an
 *  in-charge opens their own task grid. A ZM who fills the task themself opens their grid
 *  straight away. Every row shows this task's completion (done/total). */
export function TaskBreakdown({
  task,
  currentUserId,
  role,
  canNudge,
  onBack,
  onOpenTask,
}: {
  task: Pick<TrackerTaskSummaryRow, "template_id" | "name" | "target_type"> & Partial<Pick<TrackerTaskSummaryRow, "done" | "total">>;
  currentUserId: string;
  role: string;
  canNudge: boolean;
  onBack: () => void;
  onOpenTask?: (templateId: string, owner?: string, ownerName?: string) => void;
}) {
  // A ZM's own view has no ZM list above them — the backend starts them at their in-charges.
  const top: PeopleLevel = role === "ZONAL_MANAGER" ? "fellow" : "zm";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskState | "">("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to tasks
        </button>
        <div className="flex items-center gap-3">
          {onOpenTask && (
            <button
              type="button"
              onClick={() => onOpenTask(task.template_id)}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              <Table2 className="h-4 w-4" aria-hidden="true" /> Open task data
            </button>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-950">{task.name}</p>
            {task.done != null && task.total != null && <p className="text-xs text-gray-500">{task.done}/{task.total} done · {task.total} assigned</p>}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-950">{LEVEL_LABEL[top]}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              aria-label="Status"
              onChange={(e) => setStatus(e.target.value as TaskState | "")}
              className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="">All statuses</option>
              {TASK_STATE_ORDER.map((s) => <option key={s} value={s}>{TASK_STATE_META[s].label}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="h-9 w-64 rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        <PeopleList
          key={`${q}:${status}`}
          templateId={task.template_id}
          level={top}
          q={q}
          status={status}
          canNudge={canNudge}
          currentUserId={currentUserId}
          onOpen={onOpenTask && ((row) => row.id === currentUserId
            ? onOpenTask(task.template_id)
            : onOpenTask(task.template_id, row.id, row.name))}
        />
      </section>
    </div>
  );
}

/** One level of the cascade. ZM rows toggle their in-charge list open beneath them; in-charge
 *  rows (and ZMs who fill the task themself) open that person's task grid. */
function PeopleList({
  templateId,
  level,
  parentId,
  q = "",
  status,
  canNudge,
  currentUserId,
  onOpen,
}: {
  templateId: string;
  level: PeopleLevel;
  parentId?: string;
  q?: string;
  status: TaskState | "";
  canNudge: boolean;
  currentUserId: string;
  onOpen?: (row: TrackerBreakdownRow) => void;
}) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { data, isLoading, error } = useTrackerTaskBreakdown(
    templateId, level, parentId, q, page, status || undefined,
  );
  const nested = !!parentId;

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 50;
  const pages = Math.max(1, Math.ceil(total / limit));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return <div className={`flex items-center justify-center ${nested ? "py-4" : "min-h-40"}`}><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>;
  }
  if (error) {
    return <p className="flex items-center gap-2 px-5 py-4 text-sm text-red-700"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error instanceof Error ? error.message : "Failed to load."}</p>;
  }
  if (rows.length === 0) {
    return nested ? (
      <p className="px-5 py-3 text-sm text-gray-500">No {IN_CHARGE_PLURAL.toLowerCase()} here.</p>
    ) : (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 text-center">
        <CheckCircle2 className="h-6 w-6 text-gray-400" aria-hidden="true" />
        <p className="text-sm text-gray-500">Nothing to show here.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const showNudge = canNudge && row.id !== currentUserId && row.rolled_state !== "done";
          const opens = !!onOpen && (level === "fellow" || !!row.direct);
          const expands = level === "zm" && !row.direct;
          const isOpen = expanded.has(row.id);
          return (
            <li key={row.id}>
              <div className="flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => { if (expands) toggle(row.id); else if (opens) onOpen!(row); }}
                  disabled={!expands && !opens}
                  aria-expanded={expands ? isOpen : undefined}
                  className={
                    "group flex w-full items-center justify-between gap-3 rounded-md px-4 py-3.5 text-left transition-colors " +
                    (expands || opens ? "cursor-pointer hover:bg-teal-50" : "cursor-default")
                  }
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {expands && <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden="true" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-950">{row.name}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {row.direct ? <>Fills this themself · </> : expands && (
                          <>{row.child_count} {IN_CHARGE_LOWER}{row.child_count === 1 ? "" : "s"} · </>
                        )}
                        {row.done}/{row.total} done
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatePill state={row.rolled_state} />
                    {opens && <Table2 className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                  </div>
                </button>
                {showNudge && <NudgeButton doerId={row.id} templateId={templateId} lastNudgedAt={null} />}
              </div>
              {expands && isOpen && (
                <div className="mb-2 ml-8 mr-3 border-l-2 border-teal-100 bg-gray-50/60">
                  <PeopleList
                    templateId={templateId}
                    level="fellow"
                    parentId={row.id}
                    status={status}
                    canNudge={canNudge}
                    currentUserId={currentUserId}
                    onOpen={onOpen}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm text-gray-600">
          <span>{total} {LEVEL_LABEL[level].toLowerCase()}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-gray-300 px-2.5 py-1 disabled:opacity-40">Prev</button>
            <span>Page {page} / {pages}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-gray-300 px-2.5 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </>
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
