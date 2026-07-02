"use client";

import { useState } from "react";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { useTrackerMyTasks } from "@/lib/queries/tracker";
import type { TrackerMyTask } from "@/lib/tracker-api";

const LIFECYCLE: Record<TrackerMyTask["lifecycle"], { label: string; tone: "green" | "gray" | "red" | "amber" }> = {
  done: { label: "Done", tone: "green" },
  blocked: { label: "Stuck", tone: "red" },
  overdue: { label: "Overdue", tone: "amber" },
  in_progress: { label: "In progress", tone: "gray" },
  not_started: { label: "To do", tone: "gray" },
};

export function MyTasksList({ onOpen }: { onOpen: (templateId: string) => void }) {
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
  return <TaskListView tasks={data} onOpen={onOpen} emptyTitle="You're all caught up" emptyDetail="Tasks assigned to you will show up here." />;
}

export function TaskListView({
  tasks,
  onOpen,
  emptyTitle = "No tasks",
  emptyDetail = "Nothing here yet.",
}: {
  tasks: TrackerMyTask[];
  onOpen: (templateId: string) => void;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  const [priorityF, setPriorityF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [schoolF, setSchoolF] = useState("");
  const [sort, setSort] = useState<"priority" | "deadline" | "newest" | "oldest">("priority");

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-5 text-center">
        <p className="text-sm font-semibold text-gray-950">{emptyTitle}</p>
        <p className="text-sm text-gray-500">{emptyDetail}</p>
      </div>
    );
  }

  const schools = Array.from(new Set(tasks.map((t) => t.school_name).filter(Boolean) as string[])).sort();
  const prank = { high: 0, medium: 1, low: 2 } as const;
  const filtered = tasks
    .filter((t) => (!priorityF || t.priority === priorityF) && (!statusF || t.lifecycle === statusF) && (!schoolF || t.school_name === schoolF))
    .sort((a, b) => {
      if (sort === "priority") return prank[a.priority] - prank[b.priority] || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      if (sort === "deadline") return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      if (sort === "newest") return (b.issued_at ?? "").localeCompare(a.issued_at ?? "");
      return (a.issued_at ?? "").localeCompare(b.issued_at ?? "");
    });

  const selCls = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <select value={priorityF} onChange={(e) => setPriorityF(e.target.value)} className={selCls}>
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={selCls}>
          <option value="">All statuses</option>
          <option value="not_started">To do</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Stuck</option>
          <option value="overdue">Overdue</option>
          <option value="done">Done</option>
        </select>
        {schools.length > 1 && (
          <select value={schoolF} onChange={(e) => setSchoolF(e.target.value)} className={selCls}>
            <option value="">All schools</option>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selCls + " ml-auto"}>
          <option value="priority">Sort: Priority</option>
          <option value="deadline">Sort: Deadline</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">No tasks match these filters.</p>
      ) : (
      <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {filtered.map((task) => {
        const lc = LIFECYCLE[task.lifecycle];
        return (
          <li key={task.record_id}>
            <button
              type="button"
              onClick={() => onOpen(task.template_id)}
              className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-teal-50/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-950">
                  {task.name}
                  {task.target_name ? <span className="text-gray-500"> — {task.target_name}</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{task.deadline ? `Due ${formatDate(task.deadline)}` : "No deadline"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PriorityChip priority={task.priority} />
                <Pill label={lc.label} tone={lc.tone} />
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
