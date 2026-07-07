// Single source of truth for tracker STATUS roll-up. Pure (no React) so it can be shared
// by the My-Tasks list badge, the global overview strip, and the per-task cards without
// drifting. Record surfaces (the editable grid) keep the backend 5-state lifecycle; only
// grouped-task / card surfaces use the 4-state model below.

/** Backend per-record lifecycle (5 states). */
export type RecordLifecycle = "done" | "blocked" | "overdue" | "not_started" | "in_progress";

/** Task/display state (4 states). `pending` merges not_started + in_progress. */
export type TaskState = "done" | "pending" | "overdue" | "blocked";

export type StateCounts = { done: number; pending: number; blocked: number; overdue: number };

/** 5-state record lifecycle → 4-state display bucket. The one home for the pending merge. */
export function taskStateFromLifecycle(lc: RecordLifecycle): TaskState {
  if (lc === "done") return "done";
  if (lc === "blocked") return "blocked";
  if (lc === "overdue") return "overdue";
  return "pending"; // not_started | in_progress
}

/** Roll a task's target lifecycles into one task state: done only when ALL targets are
 *  done; otherwise the most urgent — blocked > overdue > pending. */
export function rollupFromLifecycles(lifecycles: RecordLifecycle[]): TaskState {
  const states = lifecycles.map(taskStateFromLifecycle);
  if (states.length > 0 && states.every((s) => s === "done")) return "done";
  if (states.some((s) => s === "blocked")) return "blocked";
  if (states.some((s) => s === "overdue")) return "overdue";
  return "pending";
}

/** Roll per-task counts (as returned by the overview endpoint) into one task state.
 *  A task with zero records in scope returns null (not counted). Same priority as
 *  rollupFromLifecycles. */
export function rollupFromCounts(c: StateCounts): TaskState | null {
  if (c.done + c.pending + c.blocked + c.overdue === 0) return null;
  if (c.blocked > 0) return "blocked";
  if (c.overdue > 0) return "overdue";
  if (c.pending > 0) return "pending";
  return "done";
}

/** Tally target lifecycles into the 4 display buckets (feeds the per-task cards). */
export function countByTaskState(lifecycles: RecordLifecycle[]): StateCounts {
  const c: StateCounts = { done: 0, pending: 0, blocked: 0, overdue: 0 };
  for (const lc of lifecycles) c[taskStateFromLifecycle(lc)] += 1;
  return c;
}

export type StateTone = "green" | "gray" | "amber" | "red";

export const TASK_STATE_META: Record<TaskState, { label: string; tone: StateTone }> = {
  done: { label: "Done", tone: "green" },
  pending: { label: "Pending", tone: "gray" },
  overdue: { label: "Overdue", tone: "amber" },
  blocked: { label: "Blocked", tone: "red" },
};

/** Fixed display order for card strips + filters. */
export const TASK_STATE_ORDER: TaskState[] = ["done", "pending", "overdue", "blocked"];
