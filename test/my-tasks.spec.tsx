import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { TrackerMyTask } from "@/lib/tracker-api";

let mockResult: { data: TrackerMyTask[]; isLoading: boolean; error: unknown };
vi.mock("@/lib/queries/tracker", () => ({
  useTrackerMyTasks: () => mockResult,
}));

import { MyTasksList } from "@/app/dashboard/tracker/_components/my-tasks";

function task(over: Partial<TrackerMyTask>): TrackerMyTask {
  return {
    record_id: "r1",
    template_id: "t1",
    name: "NEET Application (demo)",
    target_name: null,
    school_name: null,
    issued_at: "2026-07-01T00:00:00.000Z",
    deadline: null,
    target_type: "student",
    priority: "medium",
    status: "not_started",
    blocked: false,
    lifecycle: "not_started",
    ...over,
  };
}

// The task list (the <ul>), scoped so we don't match the filter <option> labels.
function list() {
  const ul = document.querySelector("ul");
  if (!ul) throw new Error("task list not rendered");
  return within(ul as HTMLElement);
}

beforeEach(() => {
  mockResult = { data: [], isLoading: false, error: null };
});

describe("MyTasksList — one row per task", () => {
  it("collapses same-template records into a single task row with a target count", () => {
    mockResult.data = [
      task({ record_id: "r1", target_name: "Ravi K", lifecycle: "done" }),
      task({ record_id: "r2", target_name: "Meena S", lifecycle: "not_started" }),
    ];
    render(<MyTasksList onOpen={() => {}} />);
    // One row, not two.
    expect(list().getAllByRole("listitem")).toHaveLength(1);
    // Count shown instead of per-student names.
    expect(list().getByText(/2 students/)).toBeTruthy();
    expect(screen.queryByText(/Ravi K/)).toBeNull();
    expect(screen.queryByText(/Meena S/)).toBeNull();
  });

  it("rolls a mixed not_started + in_progress task up to a single Pending badge", () => {
    mockResult.data = [
      task({ record_id: "r1", lifecycle: "not_started" }),
      task({ record_id: "r2", lifecycle: "in_progress" }),
    ];
    render(<MyTasksList onOpen={() => {}} />);
    expect(list().getByText("Pending")).toBeTruthy();
    expect(list().queryByText("Done")).toBeNull();
  });

  it("shows Done only when every target is done", () => {
    mockResult.data = [
      task({ record_id: "r1", lifecycle: "done" }),
      task({ record_id: "r2", lifecycle: "done" }),
    ];
    render(<MyTasksList onOpen={() => {}} />);
    expect(list().getByText("Done")).toBeTruthy();
    expect(list().queryByText("Pending")).toBeNull();
  });

  it("blocked beats overdue in the rolled-up badge", () => {
    mockResult.data = [
      task({ record_id: "r1", lifecycle: "overdue" }),
      task({ record_id: "r2", lifecycle: "blocked" }),
    ];
    render(<MyTasksList onOpen={() => {}} />);
    expect(list().getByText("Blocked")).toBeTruthy();
    expect(list().queryByText("Overdue")).toBeNull();
  });

  it("shows the target name for a single-target task (no count)", () => {
    mockResult.data = [task({ target_name: "Ravi K", lifecycle: "in_progress" })];
    render(<MyTasksList onOpen={() => {}} />);
    expect(list().getByText(/Ravi K/)).toBeTruthy();
    expect(list().queryByText(/students/)).toBeNull();
  });

  it("falls back to the template name when a single-target task has no target name", () => {
    mockResult.data = [task({ target_name: null })];
    render(<MyTasksList onOpen={() => {}} />);
    expect(list().getByText(/NEET Application \(demo\)/)).toBeTruthy();
  });
});
