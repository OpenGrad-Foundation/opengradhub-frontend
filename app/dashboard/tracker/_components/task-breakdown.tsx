"use client";

import React, { useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Search, Table2 } from "lucide-react";
import { useTrackerTaskBreakdown } from "@/lib/queries/tracker";
import type { TrackerBreakdownRow, TrackerDrillLevel, TrackerTargetType, TrackerTaskSummaryRow } from "@/lib/tracker-api";
import { TASK_STATE_META, TASK_STATE_ORDER, type TaskState } from "@/lib/tracker-status";
import { IN_CHARGE_LOWER, IN_CHARGE_PLURAL } from "@/lib/labels";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { NudgeButton } from "./nudge-button";

const LEVELS: TrackerDrillLevel[] = ["zm", "fellow", "school", "student"];

function leafFor(target: TrackerTargetType): TrackerDrillLevel {
  return target === "student" ? "student" : target === "school" ? "school" : "fellow";
}
function nextLevel(level: TrackerDrillLevel): TrackerDrillLevel | null {
  const i = LEVELS.indexOf(level);
  return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
}

const LEVEL_LABEL: Record<TrackerDrillLevel, string> = {
  zm: "Zonal Managers", fellow: IN_CHARGE_PLURAL, school: "Schools", student: "Students",
};
const CHILD_NOUN: Record<TrackerDrillLevel, string> = {
  zm: IN_CHARGE_LOWER, fellow: "school", school: "student", student: "",
};

type Crumb = { level: TrackerDrillLevel; id: string; name: string };

/** Task-scoped org drill. Reuses the breadcrumb + level-list pattern of the Team & Students
 *  browser, but every row shows this task's completion (done/total) and a child count, and the
 *  drill stops at the task's target level. */
export function TaskBreakdown({
  task,
  currentUserId,
  canNudge,
  onBack,
  onOpenTask,
}: {
  task: TrackerTaskSummaryRow;
  currentUserId: string;
  canNudge: boolean;
  onBack: () => void;
  onOpenTask?: (templateId: string) => void;
}) {
  const canViewStudents = usePermissions().has(PERM.students.view);
  const targetLeaf = leafFor(task.target_type);
  const leaf = targetLeaf === "student" && !canViewStudents ? "school" : targetLeaf;
  const [group, setGroup] = useState<TrackerDrillLevel>(leaf);
  const start = LEVELS.indexOf(group) <= LEVELS.indexOf(leaf) ? group : leaf;
  const [path, setPath] = useState<Crumb[]>([]);

  const currentLevel = path.length > 0 ? nextLevel(path[path.length - 1].level)! : start;
  const currentParentId = path.length > 0 ? path[path.length - 1].id : undefined;
  const isLeafLevel = currentLevel === leaf;

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
            <p className="text-xs text-gray-500">{task.done}/{task.total} done · {task.total} assigned</p>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600">Group by
        <select aria-label="Group task records by" value={start} onChange={event => { setGroup(event.target.value as TrackerDrillLevel); setPath([]); }} className="rounded-md border border-gray-300 bg-white px-2 py-1">
          {LEVELS.slice(0, LEVELS.indexOf(leaf) + 1).map(level => <option key={level} value={level}>{LEVEL_LABEL[level]}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-1.5 px-1 text-sm text-gray-600">
        <button
          type="button"
          onClick={() => setPath([])}
          className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          {LEVEL_LABEL[start]}
        </button>
        {path.map((crumb, i) => (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setPath(path.slice(0, i + 1))}
              className={`rounded-md px-2 py-1 transition-colors hover:bg-gray-100 hover:text-gray-900 ${i === path.length - 1 ? "font-semibold text-gray-900" : "font-medium"}`}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <LevelList
        key={`${currentLevel}:${currentParentId ?? "root"}`}
        templateId={task.template_id}
        level={currentLevel}
        parentId={currentParentId}
        isLeafLevel={isLeafLevel}
        canNudge={canNudge}
        currentUserId={currentUserId}
        onDrill={(row) => setPath([...path, { level: currentLevel, id: row.id, name: row.name }])}
      />
    </div>
  );
}

function LevelList({
  templateId,
  level,
  parentId,
  isLeafLevel,
  canNudge,
  currentUserId,
  onDrill,
}: {
  templateId: string;
  level: TrackerDrillLevel;
  parentId: string | undefined;
  isLeafLevel: boolean;
  canNudge: boolean;
  currentUserId: string;
  onDrill: (row: TrackerBreakdownRow) => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TaskState | "">("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useTrackerTaskBreakdown(
    templateId, level, parentId, q, page, status || undefined,
  );

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 50;
  const pages = Math.max(1, Math.ceil(total / limit));
  const childNoun = CHILD_NOUN[level];
  const isDoerLevel = level === "zm" || level === "fellow";

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-gray-950">{LEVEL_LABEL[level]}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            aria-label="Status"
            onChange={(e) => { setStatus(e.target.value as TaskState | ""); setPage(1); }}
            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="">All statuses</option>
            {TASK_STATE_ORDER.map((s) => <option key={s} value={s}>{TASK_STATE_META[s].label}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search…"
              className="h-9 w-64 rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
      ) : error ? (
        <p className="flex items-center gap-2 px-5 py-6 text-sm text-red-700"><AlertCircle className="h-4 w-4" aria-hidden="true" />{error instanceof Error ? error.message : "Failed to load."}</p>
      ) : rows.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 text-center">
          <CheckCircle2 className="h-6 w-6 text-gray-400" aria-hidden="true" />
          <p className="text-sm text-gray-500">Nothing to show here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => {
            const isSelf = row.id === currentUserId;
            const showNudge = canNudge && isDoerLevel && !isSelf && row.rolled_state !== "done";
            const drillable = !isLeafLevel;
            return (
              <li key={row.id} className="flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => { if (drillable) onDrill(row); }}
                  disabled={!drillable}
                  className={
                    "group flex w-full items-center justify-between gap-3 rounded-md px-4 py-3.5 text-left transition-colors " +
                    (drillable ? "cursor-pointer hover:bg-teal-50" : "cursor-default")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-950">{row.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {!isLeafLevel && childNoun && (
                        <>{row.child_count} {childNoun}{row.child_count === 1 ? "" : "s"} · </>
                      )}
                      {row.done}/{row.total} done
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatePill state={row.rolled_state} />
                    {drillable && <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                  </div>
                </button>
                {showNudge && <NudgeButton doerId={row.id} templateId={templateId} lastNudgedAt={null} />}
              </li>
            );
          })}
        </ul>
      )}

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
    </section>
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
