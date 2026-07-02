import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
    deadline: null,
    target_type: "student",
    status: "not_started",
    blocked: false,
    lifecycle: "not_started",
    ...over,
  };
}

beforeEach(() => {
  mockResult = { data: [], isLoading: false, error: null };
});

describe("MyTasksList", () => {
  it("shows the target name so same-template rows are distinguishable", () => {
    mockResult.data = [
      task({ record_id: "r1", target_name: "Ravi K", lifecycle: "done" }),
      task({ record_id: "r2", target_name: "Meena S", lifecycle: "blocked" }),
    ];
    render(<MyTasksList onOpen={() => {}} />);
    expect(screen.getByText(/Ravi K/)).toBeTruthy();
    expect(screen.getByText(/Meena S/)).toBeTruthy();
    // Distinct lifecycle pills render too.
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Stuck")).toBeTruthy();
  });

  it("renders without a target name (falls back to template name only)", () => {
    mockResult.data = [task({ target_name: null })];
    render(<MyTasksList onOpen={() => {}} />);
    expect(screen.getByText(/NEET Application \(demo\)/)).toBeTruthy();
  });
});
