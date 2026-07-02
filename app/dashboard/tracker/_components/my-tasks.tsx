"use client";

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
  if (data.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-5 text-center">
        <p className="text-sm font-semibold text-gray-950">You&apos;re all caught up</p>
        <p className="text-sm text-gray-500">Tasks assigned to you will show up here.</p>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {data.map((task) => {
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
                <Pill label={lc.label} tone={lc.tone} />
                <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Pill({ label, tone }: { label: string; tone: "green" | "gray" | "red" | "amber" }) {
  const toneClass = {
    green: "bg-emerald-50 text-emerald-700",
    gray: "bg-gray-100 text-gray-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
