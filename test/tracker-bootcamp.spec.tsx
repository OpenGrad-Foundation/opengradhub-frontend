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
vi.mock("@/lib/tracker-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracker-api")>()),
  createTrackerTemplate: (...a: unknown[]) => create(...a),
  addTrackerFields: vi.fn().mockResolvedValue({}),
  assignTrackerDoers: (...a: unknown[]) => assign(...a),
}));

import { TrackerBuilder } from "@/app/dashboard/tracker/_components/tracker-builder";
import { TrackerEditableGrid } from "@/app/dashboard/tracker/_components/tracker-grid";

afterEach(cleanup);

describe("builder: Programme → Schools → Batches, with a start/end window", () => {
  it("cascades the picks and sends several schools and batches with the window", async () => {
    render(<TrackerBuilder canAuthor />);
    fireEvent.change(screen.getByDisplayValue("Choose a programme…"), { target: { value: "p1" } });
    // Top to bottom: a staff task has no Schools / Batches pickers at all.
    expect(screen.queryByText("Schools")).toBeNull();
    fireEvent.change(screen.getByDisplayValue(/Staff/), { target: { value: "student" } });
    // Programme narrows schools; the other programme's school is gone.
    expect(screen.queryByLabelText("Elsewhere")).toBeNull();
    fireEvent.click(screen.getByLabelText("Camp School A"));
    // School narrows batches.
    expect(screen.queryByLabelText(/Other batch/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/Morning/));
    fireEvent.click(screen.getByLabelText(/Evening/));

    fireEvent.change(screen.getByPlaceholderText("Monthly Report"), { target: { value: "Attendance" } });
    fireEvent.change(screen.getByDisplayValue("One-time"), { target: { value: "daily" } });
    fireEvent.change(screen.getByLabelText(/Starts on/), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText(/Ends on/), { target: { value: "2026-10-10" } });
    fireEvent.click(screen.getByLabelText("Fellow Priya"));
    fireEvent.click(screen.getByRole("button", { name: /create & publish/i }));

    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      programme_id: "p1", recurrence_frequency: "daily", starts_on: "2026-10-01", ends_on: "2026-10-10", deadline: undefined,
    });
    expect(assign).toHaveBeenCalledWith("t1", ["f1"], { schoolIds: ["s1"], batchIds: ["b1", "b2"] });
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
    fireEvent.change(within(bar).getByLabelText("Column to fill"), { target: { value: "__status__" } });
    fireEvent.click(within(bar).getByRole("button", { name: "Apply" }));
    expect(within(bar).getByText(/Filled 2 rows/)).toBeTruthy();
  });
});
