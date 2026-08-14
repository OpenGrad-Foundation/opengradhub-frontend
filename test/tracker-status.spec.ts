import { describe, it, expect } from "vitest";
import {
  taskStateFromLifecycle,
  rollupFromLifecycles,
  rollupFromCounts,
  countByTaskState,
  type RecordLifecycle,
} from "@/lib/tracker-status";

describe("taskStateFromLifecycle (5-state record → 4-state display)", () => {
  it("maps not_started and in_progress both to pending", () => {
    expect(taskStateFromLifecycle("not_started")).toBe("pending");
    expect(taskStateFromLifecycle("in_progress")).toBe("pending");
  });
  it("passes done/blocked/overdue through", () => {
    expect(taskStateFromLifecycle("done")).toBe("done");
    expect(taskStateFromLifecycle("blocked")).toBe("blocked");
    expect(taskStateFromLifecycle("overdue")).toBe("overdue");
  });
});

describe("rollupFromLifecycles (task roll-up from its targets)", () => {
  it("is done only when every target is done", () => {
    expect(rollupFromLifecycles(["done", "done"])).toBe("done");
    expect(rollupFromLifecycles(["done", "not_started"])).toBe("pending");
  });
  it("blocked beats overdue and pending", () => {
    expect(rollupFromLifecycles(["blocked", "overdue", "in_progress"])).toBe("blocked");
  });
  it("overdue beats pending", () => {
    expect(rollupFromLifecycles(["overdue", "not_started"])).toBe("overdue");
  });
  it("mixed not_started + in_progress rolls up to pending", () => {
    expect(rollupFromLifecycles(["not_started", "in_progress"])).toBe("pending");
  });
});

describe("rollupFromCounts (task roll-up from per-task counts)", () => {
  it("returns null for an empty (zero-record) task", () => {
    expect(rollupFromCounts({ done: 0, pending: 0, blocked: 0, overdue: 0 })).toBeNull();
  });
  it("applies the same priority as rollupFromLifecycles", () => {
    expect(rollupFromCounts({ done: 2, pending: 1, blocked: 1, overdue: 1 })).toBe("blocked");
    expect(rollupFromCounts({ done: 2, pending: 1, blocked: 0, overdue: 1 })).toBe("overdue");
    expect(rollupFromCounts({ done: 2, pending: 1, blocked: 0, overdue: 0 })).toBe("pending");
    expect(rollupFromCounts({ done: 3, pending: 0, blocked: 0, overdue: 0 })).toBe("done");
  });
});

describe("countByTaskState (inner target-count buckets)", () => {
  it("tallies lifecycles into the 4 display buckets", () => {
    const lc: RecordLifecycle[] = ["done", "not_started", "in_progress", "overdue", "blocked", "done"];
    expect(countByTaskState(lc)).toEqual({ done: 2, pending: 2, overdue: 1, blocked: 1 });
  });
});

describe("agreement between the two roll-up primitives", () => {
  it("rollupFromCounts(countByTaskState(x)) === rollupFromLifecycles(x) for non-empty x", () => {
    const cases: RecordLifecycle[][] = [
      ["done", "done"],
      ["done", "not_started"],
      ["blocked", "overdue", "in_progress"],
      ["overdue", "not_started"],
      ["not_started", "in_progress"],
    ];
    for (const x of cases) {
      expect(rollupFromCounts(countByTaskState(x))).toBe(rollupFromLifecycles(x));
    }
  });
});
