import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type {
  TrackerGeoVerification, TrackerGrid, TrackerGridRow, TrackerTemplate,
} from "@/lib/tracker-api";

/**
 * The gate itself: a row whose school has no accepted visit verification cannot be
 * marked done, and reaching for it opens the verification modal instead of dead-ending
 * on a disabled control.
 */

let geoResult: { data: TrackerGeoVerification[] | undefined; isLoading: boolean };
const uploadMutate = vi.fn();
const saveMutate = vi.fn();
let savePending = false;

const idle = { mutateAsync: vi.fn(), isPending: false };
const empty = { data: undefined, isLoading: false, error: null };

vi.mock("@/lib/queries/tracker", () => ({
  useTemplateGeoVerifications: () => geoResult,
  useUploadGeoVerification: () => ({ mutateAsync: uploadMutate, isPending: false }),
  useOverrideGeoVerification: () => idle,
  useSaveTrackerBatch: () => ({ mutateAsync: saveMutate, isPending: savePending }),
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
}));

import { TrackerEditableGrid } from "@/app/dashboard/tracker/_components/tracker-grid";

const template = (over: Partial<TrackerTemplate> = {}): TrackerTemplate =>
  ({
    id: "t1", code: "VISIT", name: "School visit", description: null,
    target_type: "school", completion_style: "checklist", workflow_statuses: null,
    done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
    require_photo: false, require_location: false, require_geo_verification: true,
    status: "active", ...over,
  }) as TrackerTemplate;

const row = (over: Partial<TrackerGridRow> = {}): TrackerGridRow =>
  ({
    record_id: "r1", status: "not_started", cells: [], blocked: false, blocker: null,
    school_name: "Govt HSS Coimbatore", school_id: "s1", target_name: null,
    // The viewer is the doer of these rows: per-row authority, as the server now sends it.
    doer_id: "me", doer_name: "Me", can_fill_self: true, can_fill_override: false,
    can_evidence: true, can_blocker: true, fill_reason: null,
    lifecycle: "not_started", ...over,
  }) as TrackerGridRow;

const grid = (rows: TrackerGridRow[]): TrackerGrid => ({ columns: [], rows });

const verification = (over: Partial<TrackerGeoVerification> = {}): TrackerGeoVerification => ({
  id: "v1", school_id: "s1", doer_id: "me", status: "verified", accepted: true,
  distance_m: 34.2, radius_m: 200, accuracy_m: null,
  exif_captured_at: "2026-08-24T04:15:00.000Z",
  uploaded_at: "2026-08-24T09:00:00.000Z",
  preview_url: null, override_by: null, override_at: null, override_reason: null,
  ...over,
});

function renderGrid(props: Partial<React.ComponentProps<typeof TrackerEditableGrid>> = {}) {
  return render(
    <TrackerEditableGrid
      template={template()}
      grid={grid([row()])}
      canFill
      canClear={false}
      {...props}
    />,
  );
}

/** The desktop table and the mobile card list both render; take the table's control. */
const doneBox = () => screen.getAllByRole("checkbox")[0] as HTMLInputElement;

beforeEach(() => {
  geoResult = { data: [], isLoading: false };
  uploadMutate.mockReset();
  saveMutate.mockReset();
  savePending = false;
});

describe("tracker grid — the visit-verification gate", () => {
  it("no longer parks a verification panel above the grid", () => {
    renderGrid();
    expect(screen.queryByRole("region", { name: /school visit verification/i })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts a verification chip in the toolbar that opens the modal", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /visit verification/i }));
    expect(screen.getByRole("dialog", { name: /school visit verification/i })).toBeTruthy();
  });

  it("shows no chip when the task does not require verification", () => {
    renderGrid({ template: template({ require_geo_verification: false }) });
    expect(screen.queryByRole("button", { name: /visit verification/i })).toBeNull();
  });

  it("leaves the done control usable so the block is reachable, not dead-ended", () => {
    renderGrid();
    expect(doneBox().disabled).toBe(false);
  });

  it("opens the modal instead of marking done when the school is unverified", () => {
    renderGrid();
    fireEvent.click(doneBox());
    expect(screen.getByRole("dialog", { name: /school visit verification/i })).toBeTruthy();
  });

  it("does not stage the edit when the gate intercepts", () => {
    renderGrid();
    fireEvent.click(doneBox());
    // Nothing is dirty, so the toolbar Save never picks up a count.
    expect(screen.queryByRole("button", { name: /save \(\d+\)/i })).toBeNull();
    expect(doneBox().checked).toBe(false);
  });

  it("opens the modal on the school that blocked the row", () => {
    renderGrid({
      grid: grid([
        row({ record_id: "r1", school_id: "s1", school_name: "Govt HSS Coimbatore" }),
        row({ record_id: "r2", school_id: "s2", school_name: "Govt HSS Annexe" }),
      ]),
    });
    // Second row in the table body → the Annexe row.
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    const groups = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(groups[0]).toMatch(/Govt HSS Annexe/i);
  });

  it("marks done normally once the school is verified", () => {
    geoResult.data = [verification()];
    renderGrid();
    fireEvent.click(doneBox());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /save \(1\)/i })).toBeTruthy();
  });

  it("accepts an overridden verification as unlocking the row", () => {
    geoResult.data = [verification({
      status: "outside_radius", accepted: true,
      override_by: "u9", override_reason: "Gate locked.",
    })];
    renderGrid();
    fireEvent.click(doneBox());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps an out-of-range verification blocking", () => {
    geoResult.data = [verification({ status: "outside_radius", accepted: false })];
    renderGrid();
    fireEvent.click(doneBox());
    expect(screen.getByRole("dialog", { name: /school visit verification/i })).toBeTruthy();
  });

  it("leaves an overdue row disabled — no photo can unblock it", () => {
    renderGrid({ grid: grid([row({ lifecycle: "overdue" })]) });
    expect(doneBox().disabled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByText(/extension/i).length).toBeGreaterThan(0);
  });

  it("leaves a row with no school disabled, since nothing can be verified for it", () => {
    renderGrid({ grid: grid([row({ school_id: null, school_name: null })]) });
    expect(doneBox().disabled).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByText(/no school/i).length).toBeGreaterThan(0);
  });

  it("does not intercept un-ticking a row that is already done", () => {
    renderGrid({ grid: grid([row({ status: "done", lifecycle: "done" })]) });
    fireEvent.click(doneBox());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /save \(1\)/i })).toBeTruthy();
  });

  it("closes the gate modal once the photo is accepted", async () => {
    uploadMutate.mockResolvedValue(verification());
    renderGrid();
    fireEvent.click(doneBox());
    fireEvent.change(screen.getByLabelText(/choose an existing photo/i) as HTMLInputElement, {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers no upload to a manager drilled into someone else's rows", () => {
    renderGrid({ viewingOther: true, canFill: false });
    fireEvent.click(screen.getByRole("button", { name: /visit verification/i }));
    expect(screen.queryByLabelText(/choose an existing photo/i)).toBeNull();
  });
});

describe("tracker grid — the gate under a workflow task", () => {
  const workflow = template({
    completion_style: "workflow",
    workflow_statuses: ["planned", "visited", "done"],
    done_status: "done",
  });

  const planned = grid([row({ status: "planned" })]);

  it("opens the modal instead of advancing to the done stage", () => {
    renderGrid({ template: workflow, grid: planned });
    const select = screen.getAllByRole("combobox").at(-1) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "done" } });
    expect(screen.getByRole("dialog", { name: /school visit verification/i })).toBeTruthy();
    expect(select.value).toBe("planned");
  });

  it("still allows the stages before done", () => {
    renderGrid({ template: workflow, grid: planned });
    const select = screen.getAllByRole("combobox").at(-1) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "visited" } });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /save \(1\)/i })).toBeTruthy();
  });
});
