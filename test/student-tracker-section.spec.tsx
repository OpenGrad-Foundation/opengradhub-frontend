import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import type {
  TrackerStudentDetailsResponse,
  TrackerStudentFieldDef,
  TrackerStudentTask,
  TrackerStudentTasksResponse,
} from "@/lib/tracker-api";

const detailsState: { data: TrackerStudentDetailsResponse | null; error: unknown } =
  { data: null, error: null };
const tasksState: { data: TrackerStudentTasksResponse | null; error: unknown } =
  { data: null, error: null };
const historyCalls: Array<unknown[]> = [];

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/students/stu-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("@/lib/queries/tracker", () => ({
  useStudentDetails: () => detailsState,
  useStudentTrackerTasks: () => tasksState,
  useRecordPeriodHistory: (...args: unknown[]) => {
    historyCalls.push(args);
    return { data: { entries: [], next_cursor: null }, isLoading: false };
  },
}));

import { TrackerSection } from "@/app/dashboard/students/[id]/_components/tracker-section";

function field(over: Partial<TrackerStudentFieldDef> = {}): TrackerStudentFieldDef {
  return {
    id: "f1", field_key: "note", label: "Note", field_type: "text",
    options: null, required: false, sort_order: 0, status: "active",
    created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

function task(over: Partial<TrackerStudentTask> = {}): TrackerStudentTask {
  return {
    template_id: "t1", template_name: "Home visit", description: null,
    priority: "medium", completion_style: "checklist",
    workflow_statuses: null, done_status: null,
    deadline: "2026-09-01", recurrence_frequency: null,
    record_id: "r1", period_key: "once", status: "in_progress",
    lifecycle: "in_progress", batch_id: null, batch_name: null,
    updated_at: "2026-08-20T00:00:00.000Z", updated_by_name: "Fellow One",
    blocker: null, cells: [],
    ...over,
  };
}

beforeEach(() => {
  detailsState.data = null; detailsState.error = null;
  tasksState.data = { student_id: "stu-1", tasks: [] }; tasksState.error = null;
  historyCalls.length = 0;
});
afterEach(cleanup);

describe("TrackerSection — permission and emptiness", () => {
  it("renders nothing at all when the viewer cannot read the tracker", () => {
    detailsState.error = new Error("forbidden");
    tasksState.data = null;
    tasksState.error = new Error("forbidden");
    const { container } = render(<TrackerSection studentId="stu-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("says so when the student has no tracker tasks", () => {
    const { getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText(/no tracker tasks are assigned/i)).toBeTruthy();
  });
});

describe("TrackerSection — student details", () => {
  it("shows only fields that were actually filled", () => {
    detailsState.data = {
      student_id: "stu-1",
      details: [
        { field: field({ id: "f1", label: "Guardian" }), value: "Asha", updated_at: "2026-08-02T00:00:00.000Z" },
        { field: field({ id: "f2", label: "Aadhaar" }), value: null, updated_at: null },
      ],
    };
    const { getByText, queryByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText("Guardian")).toBeTruthy();
    expect(queryByText("Aadhaar")).toBeNull();
  });

  it("keeps falsy answers — a No and a zero are answers, not blanks", () => {
    detailsState.data = {
      student_id: "stu-1",
      details: [
        { field: field({ id: "f1", label: "Attended", field_type: "boolean" }), value: false, updated_at: "2026-08-02T00:00:00.000Z" },
        { field: field({ id: "f2", label: "Siblings", field_type: "number" }), value: 0, updated_at: "2026-08-02T00:00:00.000Z" },
      ],
    };
    const { getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText("Attended")).toBeTruthy();
    expect(getByText("No")).toBeTruthy();
    expect(getByText("0")).toBeTruthy();
  });

  it("hides the card entirely when nothing has been filled", () => {
    detailsState.data = {
      student_id: "stu-1",
      details: [{ field: field(), value: null, updated_at: null }],
    };
    const { queryByText } = render(<TrackerSection studentId="stu-1" />);
    expect(queryByText(/student details from the tracker/i)).toBeNull();
  });
});

describe("TrackerSection — task rows", () => {
  it("lists a task with its rolled-up status", () => {
    tasksState.data = { student_id: "stu-1", tasks: [task()] };
    const { getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText("Home visit")).toBeTruthy();
    expect(getByText("Pending")).toBeTruthy();
  });

  it("shows the workflow step, which the four-state badge alone would lose", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({
        completion_style: "workflow",
        workflow_statuses: ["contacted", "visited", "enrolled"],
        done_status: "enrolled",
        status: "visited",
      })],
    };
    const { getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText("Pending")).toBeTruthy();
    expect(getByText(/visited · step 2 of 3/i)).toBeTruthy();
  });

  it("distinguishes a direct row from a batch row for the same task", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [
        task({ record_id: "r1" }),
        task({ record_id: "r2", batch_id: "b1", batch_name: "NEET Batch A" }),
      ],
    };
    const { getAllByText, getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getAllByText("Home visit")).toHaveLength(2);
    expect(getByText(/via NEET Batch A/)).toBeTruthy();
  });

  it("reveals the filled values and the blocker only once the row is expanded", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({
        lifecycle: "blocked",
        blocker: { text: "family unreachable", raised_at: "2026-08-10T00:00:00.000Z" },
        cells: [
          { field_key: "note", label: "Note", value: "spoke to neighbour", locked: false, notSet: false },
          { field_key: "ok", label: "Consent", value: false, locked: false, notSet: false },
        ],
      })],
    };
    const { getByRole, queryByText, getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(queryByText("spoke to neighbour")).toBeNull();

    fireEvent.click(getByRole("button", { name: /home visit/i }));
    expect(getByText("spoke to neighbour")).toBeTruthy();
    expect(getByText("No")).toBeTruthy();
    expect(getByText(/family unreachable/)).toBeTruthy();
  });

  it("links the task name into the tracker, deep-linked to that task", () => {
    tasksState.data = { student_id: "stu-1", tasks: [task({ template_id: "tpl-9" })] };
    const { getByRole } = render(<TrackerSection studentId="stu-1" />);
    const link = getByRole("link", { name: /open home visit in the tracker/i });
    // Carries the origin so the tracker's back control returns to this profile.
    expect(link.getAttribute("href")).toBe(
      "/dashboard/tracker?task=tpl-9&from=" + encodeURIComponent("/dashboard/students/stu-1"),
    );
  });

  it("expands when the row itself is clicked, not only the name", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({ cells: [{ field_key: "note", label: "Note", value: "row click", locked: false, notSet: false }] })],
    };
    const { getByText, queryByText } = render(<TrackerSection studentId="stu-1" />);
    expect(queryByText("row click")).toBeNull();
    // Any cell — here the status badge — stands in for "somewhere on the row".
    fireEvent.click(getByText("Pending").closest("tr")!);
    expect(getByText("row click")).toBeTruthy();
  });

  it("navigates without expanding when the tracker icon is clicked", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({ cells: [{ field_key: "note", label: "Note", value: "stay shut", locked: false, notSet: false }] })],
    };
    const { getByRole, queryByText } = render(<TrackerSection studentId="stu-1" />);
    fireEvent.click(getByRole("link", { name: /open home visit in the tracker/i }));
    expect(queryByText("stay shut")).toBeNull();
  });

  it("keeps expanding separate from navigating", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({ cells: [{ field_key: "note", label: "Note", value: "seen", locked: false, notSet: false }] })],
    };
    const { getByRole, queryByText, getByText } = render(<TrackerSection studentId="stu-1" />);
    // The link must not be what reveals the detail row.
    expect(queryByText("seen")).toBeNull();
    fireEvent.click(getByRole("button", { name: /home visit/i }));
    expect(getByText("seen")).toBeTruthy();
  });

  it("renders a date-only deadline as that calendar day, not the UTC-shifted one", () => {
    tasksState.data = { student_id: "stu-1", tasks: [task({ deadline: "2026-09-01" })] };
    const { getByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText(/1 Sep 2026|Sep 1, 2026/)).toBeTruthy();
  });

  it("says Not started rather than crediting an untouched row to anyone", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({ status: "not_started", lifecycle: "not_started", updated_at: null, updated_by_name: null })],
    };
    const { getByText, queryByText } = render(<TrackerSection studentId="stu-1" />);
    expect(getByText("Not started")).toBeTruthy();
    expect(queryByText(/^by /)).toBeNull();
  });

  it("reads earlier periods through the student-scoped route", () => {
    tasksState.data = {
      student_id: "stu-1",
      tasks: [task({ recurrence_frequency: "daily" })],
    };
    const { getByRole } = render(<TrackerSection studentId="stu-1" />);
    fireEvent.click(getByRole("button", { name: /home visit/i }));

    // useRecordPeriodHistory(recordId, enabled, before, limit, studentId)
    const call = historyCalls.find((c) => c[0] === "r1");
    expect(call).toBeTruthy();
    expect(call![4]).toBe("stu-1");
  });
});
