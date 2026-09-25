import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

// Bootcamp attendance: Programme → Schools → Batches in the builder, a start/end window
// on a repeating task, and "Fill all" on the grid so 600 rows are not 600 clicks.
const idle = { mutateAsync: vi.fn(), isPending: false };
const empty = { data: undefined, isLoading: false, error: null };
vi.mock("@/lib/queries/tracker", () => ({
  useTemplateGeoVerifications: () => empty,
  useUploadGeoVerification: () => idle,
  useOverrideGeoVerification: () => idle,
  useSaveTrackerBatch: () => idle,
  useSaveTrackerBatchOnBehalf: () => idle,
  useRaiseTrackerBlocker: () => idle,
  useClearTrackerBlocker: () => idle,
  useRecordGeoVerification: () => empty,
  useTrackerRecordHistory: () => empty,
  useRecordPeriodHistory: () => empty,
  useRecordExtensions: () => empty,
  useGrantExtension: () => idle,
  useTrackerProofs: () => empty,
  useUploadProofPhoto: () => idle,
  useDeleteProofPhoto: () => idle,
  useCaptureProofLocation: () => idle,
  useStudentDetails: () => empty,
  useSaveStudentDetails: () => idle,
  useProfilePaths: () => ({ data: { paths: [] } }),
  useTrackerMyProgrammes: () => ({ data: [{ id: "p1", name: "Bootcamp" }, { id: "p2", name: "Other" }] }),
  useTrackerAssignable: (t: string) => ({
    isLoading: false,
    data: t === "school"
      ? [
          { id: "s1", name: "Camp School A", state: null, programmes: [{ id: "p1", name: "Bootcamp" }] },
          { id: "s2", name: "Camp School B", state: null, programmes: [{ id: "p1", name: "Bootcamp" }] },
          { id: "s3", name: "Elsewhere", state: null, programmes: [{ id: "p2", name: "Other" }] },
        ]
      : [{ id: "f1", name: "Fellow Priya", role: "FELLOW", state: null, programmes: [{ id: "p1", name: "Bootcamp" }], schools: [{ id: "s1", name: "Camp School A" }] }],
  }),
}));
vi.mock("@/lib/queries/batches", () => ({
  useBatches: () => ({
    data: [
      { id: "b1", name: "Morning", school_id: "s1", school_name: "Camp School A", programme_id: "p1", member_count: 300 },
      { id: "b2", name: "Evening", school_id: "s1", school_name: "Camp School A", programme_id: "p1", member_count: 300 },
      { id: "b3", name: "Other batch", school_id: "s2", school_name: "Camp School B", programme_id: "p1", member_count: 10 },
      { id: "b4", name: "Wrong programme", school_id: "s3", school_name: "Elsewhere", programme_id: "p2", member_count: 10 },
    ],
  }),
}));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));
const create = vi.fn().mockResolvedValue({ id: "t1" });
const assign = vi.fn().mockResolvedValue({ created: 600, skipped: 0 });
const pastGrid = vi.fn();
const exportFile = vi.fn().mockResolvedValue({ blob: new Blob(["x"]), filename: "attendance-2026-09-27-records.csv" });
vi.mock("@/lib/tracker-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracker-api")>()),
  createTrackerTemplate: (...a: unknown[]) => create(...a),
  addTrackerFields: vi.fn().mockResolvedValue({}),
  assignTrackerDoers: (...a: unknown[]) => assign(...a),
  getTaskPeriods: vi.fn().mockResolvedValue(["2026-09-28", "2026-09-27", "2026-09-26"]),
  fetchTaskExport: (...a: unknown[]) => exportFile(...a),
  getTrackerGrid: (...a: unknown[]) => pastGrid(...a),
}));

import { TrackerBuilder } from "@/app/dashboard/tracker/_components/tracker-builder";
import { TrackerEditableGrid } from "@/app/dashboard/tracker/_components/tracker-grid";

afterEach(cleanup);

describe("builder: Programme → Target → schools with their batches, start/end window", () => {
  it("ticks a school whole, narrows it to one batch (partial), auto-picks the in-charge, sends the union", async () => {
    render(<TrackerBuilder canAuthor />);
    fireEvent.change(screen.getByDisplayValue("Choose a programme…"), { target: { value: "p1" } });
    // Top to bottom: a staff task has no school picker at all.
    expect(screen.queryByLabelText("Search schools and batches")).toBeNull();
    fireEvent.change(screen.getByDisplayValue(/Staff/), { target: { value: "student" } });
    // Programme narrows schools; the other programme's school is gone.
    expect(screen.queryByLabelText("Elsewhere")).toBeNull();

    const schoolA = screen.getByLabelText("Camp School A") as HTMLInputElement;
    fireEvent.click(schoolA);
    expect(schoolA.checked).toBe(true);
    // Its in-charge is picked under "Who fills this in?".
    expect((screen.getByLabelText("Fellow Priya") as HTMLInputElement).checked).toBe(true);

    // Open its batches and drop one: the school turns partial (–), one batch remains.
    fireEvent.click(screen.getByRole("button", { name: /2\/2 batches/ }));
    fireEvent.click(screen.getByLabelText(/Evening/));
    expect(schoolA.checked).toBe(false);
    expect(schoolA.indeterminate).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Monthly Report"), { target: { value: "Attendance" } });
    fireEvent.change(screen.getByDisplayValue("One-time"), { target: { value: "daily" } });
    fireEvent.change(screen.getByLabelText(/Starts on/), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText(/Ends on/), { target: { value: "2026-10-10" } });
    fireEvent.click(screen.getByRole("button", { name: /create & publish/i }));

    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      programme_id: "p1", recurrence_frequency: "daily", starts_on: "2026-10-01", ends_on: "2026-10-10", deadline: undefined,
    });
    expect(assign).toHaveBeenCalledWith("t1", ["f1"], { schoolIds: [], batchIds: ["b1"] });
  });

  it("select-all buttons toggle back off", () => {
    render(<TrackerBuilder canAuthor />);
    fireEvent.change(screen.getByDisplayValue("Choose a programme…"), { target: { value: "p1" } });
    fireEvent.change(screen.getByDisplayValue(/Staff/), { target: { value: "student" } });
    const all = screen.getByRole("button", { name: /Select all 2 schools/ });
    fireEvent.click(all);
    expect((screen.getByLabelText("Camp School B") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Deselect all 2 schools/ }));
    expect((screen.getByLabelText("Camp School B") as HTMLInputElement).checked).toBe(false);
    // Unticking the schools takes the auto-picked in-charge back out too.
    expect((screen.getByLabelText("Fellow Priya") as HTMLInputElement).checked).toBe(false);
  });
});

describe("grid: Fill all shown rows", () => {
  const template = ({
    id: "t1", code: "ATT", name: "Attendance", description: null, target_type: "student",
    completion_style: "checklist", workflow_statuses: null, done_status: null, deadline: null,
    priority: "medium", recurrence_frequency: "daily", require_photo: false, require_location: false,
    require_geo_verification: false, status: "active",
  }) as TrackerTemplate;
  const row = (id: string, self: boolean) => ({
    record_id: id, target_name: id, status: "not_started", lifecycle: "not_started",
    cells: [{ field_key: "attendance", value: null }], blocked: false, blocker: null,
    can_fill_self: self, can_fill_override: false, can_evidence: self, can_blocker: false,
  }) as TrackerGridRow;
  const grid: TrackerGrid = {
    columns: [{ field_key: "attendance", label: "Attendance", field_type: "select", source: "input", options: ["Present", "Absent"], source_path: null, required: true, visible_if: null, sort_order: 0 }],
    rows: [row("a", true), row("b", true), row("c", false)],
  };

  it("drafts the value into every row the viewer may edit, then the status", () => {
    render(<TrackerEditableGrid template={template} grid={grid} canFill canClear={false} />);
    const bar = screen.getByText(/Fill all 2 shown rows/).parentElement as HTMLElement;
    fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    expect(screen.getAllByRole("button", { name: /Save \(2\)/ }).length).toBeGreaterThan(0);
    // Answering the required field already ticked Done, so a separate Done pass has nothing left.
    fireEvent.change(within(bar).getByLabelText("Column to fill"), { target: { value: "__status__" } });
    fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    expect(within(bar).getByText(/Nothing to change/)).toBeTruthy();
  });
});

describe("grid: view and export a past day of a repeating task", () => {
  it("switches to the picked day read-only, and exports that day", async () => {
    const template = ({
      id: "t1", code: "ATT", name: "Attendance", description: null, target_type: "student",
      completion_style: "checklist", workflow_statuses: null, done_status: null, deadline: null,
      priority: "medium", recurrence_frequency: "daily", require_photo: false, require_location: false,
      require_geo_verification: false, status: "active",
    }) as TrackerTemplate;
    const row = (id: string, name: string, period: string) => ({
      record_id: id, target_name: name, period_key: period, status: "not_started", lifecycle: "not_started",
      cells: [], blocked: false, blocker: null, can_fill_self: true, can_fill_override: false, can_evidence: true, can_blocker: false,
    }) as unknown as TrackerGridRow;
    const today: TrackerGrid = { columns: [], rows: [row("a", "Today Kid", "2026-09-28")] };
    pastGrid.mockResolvedValueOnce({ columns: [], rows: [row("b", "Past Kid", "2026-09-27")] });
    URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn();
    render(<TrackerEditableGrid template={template} grid={today} canFill canClear={false} canExport />);
    const picker = screen.getByLabelText("Period to view");
    fireEvent.focus(picker);
    // Today's own key is not offered twice.
    await waitFor(() => expect(within(picker).getByRole("option", { name: "2026-09-27" })).toBeTruthy());
    expect(within(picker).queryByRole("option", { name: "2026-09-28" })).toBeNull();
    fireEvent.change(picker, { target: { value: "2026-09-27" } });
    expect(await screen.findAllByText("Past Kid")).not.toHaveLength(0);
    expect(screen.getByText(/read-only/)).toBeTruthy();
    expect(screen.queryByText(/Fill all/)).toBeNull();
    expect(pastGrid).toHaveBeenCalledWith("t1", undefined, "2026-09-27");
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Records only/ }));
    await waitFor(() => expect(exportFile).toHaveBeenCalledWith("t1", { history: false, ownerId: undefined, period: "2026-09-27" }));
  });
});

describe("grid: marking completes the student, and unsaved marks are guarded", () => {
  const template = ({
    id: "t1", code: "ATT", name: "Attendance", description: null, target_type: "student",
    completion_style: "checklist", workflow_statuses: null, done_status: null, deadline: null,
    priority: "medium", recurrence_frequency: "daily", require_photo: false, require_location: false,
    require_geo_verification: false, status: "active",
  }) as TrackerTemplate;
  const row = (id: string, lifecycle = "not_started") => ({
    record_id: id, target_name: `Kid ${id}`, status: "not_started", lifecycle,
    cells: [{ field_key: "present", value: null }], blocked: false, blocker: null,
    can_fill_self: true, can_fill_override: false, can_evidence: true, can_blocker: false,
  }) as TrackerGridRow;
  const grid: TrackerGrid = {
    columns: [{ field_key: "present", label: "Present?", field_type: "select", source: "input", source_path: null, options: ["Present", "Absent"], required: true, visible_if: null, sort_order: 0 }],
    rows: [row("a"), row("b"), row("c", "overdue")],
  };

  it("fill-all of the required answer ticks Done, except where a gate would refuse it", () => {
    render(<TrackerEditableGrid template={template} grid={grid} canFill canClear={false} />);
    const bar = screen.getByText(/Fill all 3 shown rows/).parentElement as HTMLElement;
    fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    // a and b are done; c is overdue, so it keeps its answer but not the tick.
    expect(screen.getAllByRole("checkbox", { checked: true }).filter((el) => !within(bar).queryByRole("checkbox"))).toHaveLength(2);
  });

  it("warns before leaving with unsaved marks", () => {
    render(<TrackerEditableGrid template={template} grid={grid} canFill canClear={false} />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    const bar = screen.getByText(/Fill all 3 shown rows/).parentElement as HTMLElement;
    fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
