"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { useTrackerMyTasks } from "@/lib/queries/tracker";
import type { TrackerMyTask } from "@/lib/tracker-api";
import { rollupFromLifecycles, TASK_STATE_META, type StateCounts, type TaskState } from "@/lib/tracker-status";
import { applyFilters, type FilterDef, type FilterState } from "@/lib/filters";
import { StatusCards } from "./status-cards";
import { FilterBar } from "./filter-bar";
import { myTasksGroupFilterSpec, myTasksRecordFilterSpec } from "./filter-specs";

const TARGET_NOUN: Record<TrackerMyTask["target_type"], string> = {
  student: "students",
  fellow: "staff",
  school: "schools",
};

/** One row per task. A task targeting many students/schools produces one record per
 *  target on the server; we collapse those into a single task row (drill in to see the
 *  individual targets in the grid) and surface a rolled-up task state + progress count. */
type GroupedTask = {
  template_id: string;
  name: string;
  target_type: TrackerMyTask["target_type"];
  priority: TrackerMyTask["priority"];
  deadline: string | null;
  issued_at: string;
  count: number;
  doneCount: number;
  state: TaskState; // rolled-up 4-state task status (the record grid keeps the 5-state lifecycle)
  target_name: string | null; // shown only when the task has a single target
};

function groupTasksByTemplate(tasks: TrackerMyTask[]): GroupedTask[] {
  const byTemplate = new Map<string, TrackerMyTask[]>();
  for (const t of tasks) {
    const arr = byTemplate.get(t.template_id);
    if (arr) arr.push(t);
    else byTemplate.set(t.template_id, [t]);
  }
  const out: GroupedTask[] = [];
  for (const recs of byTemplate.values()) {
    const first = recs[0];
    const count = recs.length;
    const doneCount = recs.filter((r) => r.lifecycle === "done").length;
    out.push({
      template_id: first.template_id,
      name: first.name,
      target_type: first.target_type,
      priority: first.priority,
      deadline: first.deadline, // deadline comes from the template, uniform across records
      issued_at: recs.map((r) => r.issued_at).filter(Boolean).sort()[0] ?? first.issued_at,
      count,
      doneCount,
      state: rollupFromLifecycles(recs.map((r) => r.lifecycle)),
      target_name: count === 1 ? first.target_name : null,
    });
  }
  return out;
}

export function MyTasksList({
  onOpen, filters,
}: {
  onOpen: (templateId: string) => void;
  filters?: FilterControls;
}) {
  const { data = [], isLoading, error } = useTrackerMyTasks();
  if (isLoading) {
    return <div className="flex min-h-40 items-center justify-center rounded-lg border border-gray-200 bg-white"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>;
  }
  if (error) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-5 text-center">
        <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
        <p className="text-sm font-medium text-red-800">{error instanceof Error ? error.message : "Failed to load your tasks."}</p>
      </div>
    );
  }
  return <TaskListView tasks={data} onOpen={onOpen} filters={filters} emptyTitle="You're all caught up" emptyDetail="Tasks assigned to you will show up here." />;
}

/** Filter state plus its setters. Supplied by the page (URL-backed) for the main
 *  My Tasks tab; the component falls back to local state where a list is embedded
 *  in another view and does not own the URL. */
export type FilterControls = {
  state: FilterState;
  set: (patch: FilterState) => void;
  clear: () => void;
  activeCount: number;
};

function useLocalFilters(): FilterControls {
  const [state, setState] = useState<FilterState>({});
  return {
    state,
    set: (patch) => setState((prev) => ({ ...prev, ...patch })),
    clear: () => setState({}),
    activeCount: Object.values(state).filter((v) =>
      typeof v === "string" ? v.trim() !== "" : typeof v === "boolean" ? v : Boolean(v?.from || v?.to)).length,
  };
}

export function TaskListView({
  tasks,
  onOpen,
  filters,
  emptyTitle = "No tasks",
  emptyDetail = "Nothing here yet.",
}: {
  tasks: TrackerMyTask[];
  onOpen: (templateId: string) => void;
  filters?: FilterControls;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  const local = useLocalFilters();
  const f = filters ?? local;
  const [sort, setSort] = useState<"priority" | "deadline" | "newest" | "oldest">("priority");

  // School options come from the rows themselves, keyed by ID: two schools may share
  // a name, and filtering by name would silently merge them.
  const schoolOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const t of tasks) if (t.school_id) byId.set(t.school_id, t.school_name ?? t.school_id);
    return [...byId].map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks]);

  const recordSpec = useMemo<FilterDef<TrackerMyTask>[]>(
    () => myTasksRecordFilterSpec.map((d) => (d.key === "school" ? { ...d, options: schoolOptions } : d)),
    [schoolOptions],
  );
  // One bar, both stages: the split is about WHEN each filter runs, not what the
  // user sees. School is dropped when there is nothing to choose between.
  const barSpec = useMemo(
    () => [...myTasksGroupFilterSpec, ...recordSpec.filter((d) => d.key !== "school" || schoolOptions.length > 1)],
    [recordSpec, schoolOptions.length],
  ) as FilterDef<never>[];

  const { groups, filtered, counts } = useMemo(() => {
    // Stage 1 — record-level filters, BEFORE grouping. School, issue date and proof
    // all describe a record; applying them after the rollup would ask "is this task
    // in that school" of a task spanning five.
    const records = applyFilters(tasks, recordSpec, f.state);
    const grouped = groupTasksByTemplate(records);

    // Stage 2 — task-level filters, against the rolled-up state.
    const shown = applyFilters(grouped, myTasksGroupFilterSpec, f.state);

    // The cards count everything the OTHER filters admit, with the status filter
    // itself removed — so every card shows a number you can actually reach, and
    // picking one narrows the list without changing its neighbours.
    const forCounts = applyFilters(grouped, myTasksGroupFilterSpec, { ...f.state, status: undefined });
    const tally: StateCounts = { done: 0, pending: 0, blocked: 0, overdue: 0 };
    for (const g of forCounts) tally[g.state] += 1;
    return { groups: grouped, filtered: shown, counts: tally };
  }, [tasks, recordSpec, f.state]);

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-5 text-center">
        <p className="text-sm font-semibold text-gray-950">{emptyTitle}</p>
        <p className="text-sm text-gray-500">{emptyDetail}</p>
      </div>
    );
  }

  const prank = { high: 0, medium: 1, low: 2 } as const;
  const ordered = [...filtered].sort((a, b) => {
    if (sort === "priority") return prank[a.priority] - prank[b.priority] || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
    if (sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
    if (sort === "newest") return (b.issued_at ?? "").localeCompare(a.issued_at ?? "");
    return (a.issued_at ?? "").localeCompare(b.issued_at ?? "");
  });
  void groups;

  const activeStatus = (f.state.status ?? null) as TaskState | null;
  const selCls = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500";

  return (
    <div className="flex flex-col gap-3">
      <StatusCards
        counts={counts}
        activeState={activeStatus}
        onSelect={(s) => f.set({ status: activeStatus === s ? undefined : s })}
      />
      <FilterBar
        spec={barSpec} state={f.state} set={f.set} clear={f.clear} activeCount={f.activeCount}
        primaryKeys={["priority", "status"]}
      >
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selCls + " ml-auto"}>
          <option value="priority">Sort: Priority</option>
          <option value="deadline">Sort: Deadline</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </FilterBar>
      {ordered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">No tasks match these filters.</p>
      ) : (
      <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {ordered.map((task) => {
        const meta = TASK_STATE_META[task.state];
        return (
          <li key={task.template_id}>
            <button
              type="button"
              onClick={() => onOpen(task.template_id)}
              className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-teal-50/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-950">
                  {task.name}
                  {task.count === 1 && task.target_name ? <span className="text-gray-500"> — {task.target_name}</span> : null}
                  {task.count > 1 ? <span className="text-gray-500"> · {task.count} {TARGET_NOUN[task.target_type]}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {task.count > 1 ? `${task.doneCount}/${task.count} done · ` : ""}
                  {task.deadline ? `Due ${formatDate(task.deadline)}` : "No deadline"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PriorityChip priority={task.priority} />
                <Pill label={meta.label} tone={meta.tone} />
                <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
            </button>
          </li>
        );
      })}
      </ul>
      )}
    </div>
  );
}

function PriorityChip({ priority }: { priority: TrackerMyTask["priority"] }) {
  const map = {
    high: "border-red-200 bg-red-50 text-red-700",
    medium: "border-gray-200 bg-gray-50 text-gray-600",
    low: "border-gray-200 bg-white text-gray-400",
  } as const;
  return <span className={`inline-flex w-16 justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${map[priority]}`}>{priority}</span>;
}

function Pill({ label, tone }: { label: string; tone: "green" | "gray" | "red" | "amber" }) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return <span className={`inline-flex w-24 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
