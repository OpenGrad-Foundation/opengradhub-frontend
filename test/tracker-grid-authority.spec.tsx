import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackerGrid, TrackerGridRow, TrackerTemplate, TrackerGeoVerification } from "@/lib/tracker-api";

/**
 * One grid, several doers. Which controls a row offers is decided by the row's own
 * capabilities, not by the route that reached the grid — the route-derived flag is what
 * used to hand a manager editable cells on rows the server refuses ("out of scope").
 */

const saveMutate = vi.fn().mockResolvedValue({ saved: 1 });
const overrideMutate = vi.fn().mockResolvedValue({ saved: 1 });
const idle = { mutateAsync: vi.fn(), isPending: false };
const empty = { data: undefined, isLoading: false, error: null };
const geoResult: { data: TrackerGeoVerification[] | undefined } = { data: undefined };

vi.mock("@/lib/queries/tracker", () => ({
  useTemplateGeoVerifications: () => geoResult,
  useUploadGeoVerification: () => idle,
  useOverrideGeoVerification: () => idle,
  useSaveTrackerBatch: () => ({ mutateAsync: saveMutate, isPending: false }),
  useSaveTrackerBatchOnBehalf: () => ({ mutateAsync: overrideMutate, isPending: false }),
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
    target_type: "student", completion_style: "checklist", workflow_statuses: null,
    done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
    require_photo: false, require_location: false, require_geo_verification: false,
    status: "active", ...over,
  }) as TrackerTemplate;

const base = {
  status: "not_started", cells: [], blocked: false, blocker: null,
  school_name: null, school_id: null, target_name: "A student", lifecycle: "not_started",
} as unknown as TrackerGridRow;

/** The viewer's own row. */
const mine = (over: Partial<TrackerGridRow> = {}): TrackerGridRow => ({
  ...base, record_id: "mine", doer_id: "me", doer_name: "Me",
  can_fill_self: true, can_fill_override: false, can_evidence: true, can_blocker: true,
  fill_reason: null, ...over,
} as TrackerGridRow);

/** A subordinate's row: overridable, never ordinarily fillable. */
const theirs = (over: Partial<TrackerGridRow> = {}): TrackerGridRow => ({
  ...base, record_id: "theirs", doer_id: "A", doer_name: "Asha",
  can_fill_self: false, can_fill_override: true, can_evidence: false, can_blocker: false,
  fill_reason: null, ...over,
} as TrackerGridRow);

/** A row from a payload older than per-row authority. */
const unknownRow = (over: Partial<TrackerGridRow> = {}): TrackerGridRow =>
  ({ ...base, record_id: "unknown", ...over }) as TrackerGridRow;

const grid = (rows: TrackerGridRow[]): TrackerGrid => ({ columns: [], rows });

function renderGrid(rows: TrackerGridRow[], props: Partial<React.ComponentProps<typeof TrackerEditableGrid>> = {}) {
  return render(
    <TrackerEditableGrid
      template={template()}
      grid={grid(rows)}
      canFill
      canClear={false}
      // Deliberately the DEEP-LINK route: no owner at all. Authority must come from the rows.
      owner={null}
      canOverrideFill
      {...props}
    />,
  );
}

async function startSession(reason = "On leave; visit confirmed by phone.") {
  fireEvent.click(screen.getByRole("button", { name: /fill on behalf/i }));
  fireEvent.change(screen.getByRole("textbox", { name: /why are you filling/i }), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: /start filling/i }));
  await waitFor(() => expect(screen.getByText(/recorded in this task's history/i)).toBeTruthy());
}

beforeEach(() => {
  saveMutate.mockClear();
  overrideMutate.mockClear();
  geoResult.data = undefined;
});

describe("a grid mixing doers", () => {
  it("edits the viewer's own rows and locks the rest, whatever route opened it", () => {
    renderGrid([mine(), theirs()]);
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.filter((b) => !b.disabled).length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.disabled).length).toBeGreaterThan(0);
  });

  it("offers Fill on behalf without an owner prop, because a row says it may be overridden", () => {
    renderGrid([mine(), theirs()]);
    const btn = screen.getByRole("button", { name: /fill on behalf/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.title).toMatch(/1 outstanding row/i);
  });

  it("offers nothing to override when every foreign row is already complete", () => {
    renderGrid([mine(), theirs({ status: "done", lifecycle: "done" })]);
    const btn = screen.getByRole("button", { name: /fill on behalf/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("hides the override button on a grid of the viewer's own rows", () => {
    renderGrid([mine()]);
    expect(screen.queryByRole("button", { name: /fill on behalf/i })).toBeNull();
  });

  it("gives an admin a Save button on rows they may fill but do not own", () => {
    // SUPER_ADMIN fills any row ordinarily but owns no evidence: gating Save on evidence
    // ownership left the cells editable with nothing to submit them.
    const adminRow = theirs({
      record_id: "admin", can_fill_self: true, can_fill_override: true,
      can_evidence: false, can_blocker: true,
    });
    renderGrid([adminRow]);
    const save = (screen.getAllByRole("button") as HTMLButtonElement[])
      .find((b) => /^save/i.test(b.textContent ?? "") && b.className.includes("bg-teal-600"));
    expect(save).toBeTruthy();
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).some((b) => !b.disabled)).toBe(true);
  });

  it("keeps a row read-only when the server sent no capabilities for it", () => {
    renderGrid([unknownRow()]);
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).every((b) => b.disabled)).toBe(true);
    expect(screen.getByText(/still loading their permissions/i)).toBeTruthy();
  });
});

describe("an override session", () => {
  it("unlocks the foreign rows and leaves an unknown row closed", async () => {
    renderGrid([theirs(), unknownRow()]);
    await startSession();
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.filter((b) => !b.disabled).length).toBeGreaterThan(0);
    expect(boxes.filter((b) => b.disabled).length).toBeGreaterThan(0);
  });

  it("still enforces the viewer's own completion gates while it waives the doer's", async () => {
    // An own row takes the ordinary route, which enforces every gate — so an override
    // session must not unlock it.
    renderGrid(
      [mine({ lifecycle: "overdue" }), theirs({ lifecycle: "overdue" })],
      { template: template({ require_photo: true }) },
    );
    await startSession();
    expect(screen.getAllByText(/waives its requirements/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ask your zm or pm for an extension/i).length).toBeGreaterThan(0);
  });
});

describe("doer-only surfaces", () => {
  it("offers a blocker box on an own row and a dash on someone else's", () => {
    renderGrid([mine(), theirs()]);
    expect(screen.getAllByPlaceholderText(/what's stuck\?/i).length).toBe(2); // table + card
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("treats a missing photo as missing even where the upload control is hidden", () => {
    // proofReady is populated by the proofs control, which only mounts on own rows: without a
    // seed from the row itself, a foreign row's absent photo would read as satisfied.
    renderGrid(
      [theirs({ has_photo_proof: false })],
      { template: template({ require_photo: true }) },
    );
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).every((b) => b.disabled)).toBe(true);
  });

  it("does not let one In-Charge's visit satisfy another's row", async () => {
    geoResult.data = [{
      id: "v1", school_id: "s1", doer_id: "B", status: "verified", accepted: true,
      distance_m: 10, radius_m: 200, accuracy_m: null, exif_captured_at: "", uploaded_at: "",
      preview_url: null, override_by: null, override_at: null, override_reason: null,
    } as TrackerGeoVerification];
    renderGrid(
      [theirs({ school_id: "s1", school_name: "Govt HSS", doer_id: "A" })],
      { template: template({ require_geo_verification: true }), canOverrideFill: false },
    );
    // The verification belongs to doer B; doer A's row stays gated.
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).every((b) => b.disabled)).toBe(true);
  });
});
