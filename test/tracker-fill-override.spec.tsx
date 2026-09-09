import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

/**
 * Filling in someone else's name: a deliberate mode behind a reason, not the default,
 * and strictly narrower than an ordinary fill — the doer-only surfaces (proofs, blockers,
 * student details, bulk upload) stay off while it is active.
 */

const saveMutate = vi.fn().mockResolvedValue({ saved: 1 });
const overrideMutate = vi.fn().mockResolvedValue({ saved: 1 });
const idle = { mutateAsync: vi.fn(), isPending: false };
const empty = { data: undefined, isLoading: false, error: null };

vi.mock("@/lib/queries/tracker", () => ({
  useTemplateGeoVerifications: () => empty,
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
    target_type: "fellow", completion_style: "checklist", workflow_statuses: null,
    done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
    require_photo: false, require_location: false, require_geo_verification: false,
    status: "active", ...over,
  }) as TrackerTemplate;

const row = (over: Partial<TrackerGridRow> = {}): TrackerGridRow =>
  ({
    record_id: "r1", status: "not_started", cells: [], blocked: false, blocker: null,
    school_name: null, school_id: null, target_name: "Priya S",
    // Someone else's row, as the server describes it: overridable, never ordinarily fillable.
    doer_id: "f1", doer_name: "Priya S", can_fill_self: false, can_fill_override: true,
    can_evidence: false, can_blocker: false, fill_reason: null,
    lifecycle: "not_started", ...over,
  }) as TrackerGridRow;

const grid = (rows: TrackerGridRow[] = [row()]): TrackerGrid => ({ columns: [], rows });

const OWNER = { id: "f1", name: "Priya S" };

function renderGrid(props: Partial<React.ComponentProps<typeof TrackerEditableGrid>> = {}) {
  return render(
    <TrackerEditableGrid
      template={template()}
      grid={grid()}
      canFill
      canClear={false}
      canOverrideFill
      owner={OWNER}
      {...props}
    />,
  );
}

/** Walk from a read-only drill-in into an active on-behalf session. */
async function startSession(reason = "On emergency leave; confirmed by phone.") {
  fireEvent.click(screen.getByRole("button", { name: /fill on behalf/i }));
  fireEvent.change(screen.getByRole("textbox", { name: /why are you filling/i }), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole("button", { name: /start filling/i }));
  await waitFor(() => expect(screen.getByText(/filling as priya s/i)).toBeTruthy());
}

beforeEach(() => {
  saveMutate.mockClear();
  overrideMutate.mockClear();
});

describe("drilled into someone else's rows", () => {
  it("is read-only until the manager opts in, even though they hold tracker.fill", () => {
    renderGrid();
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /^save/i })).toBeNull();
    expect(screen.getByRole("button", { name: /fill on behalf/i })).toBeTruthy();
  });

  it("offers nothing extra to a manager without the override permission", () => {
    renderGrid({ canOverrideFill: false });
    expect(screen.queryByRole("button", { name: /fill on behalf/i })).toBeNull();
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  });

  it("leaves a fellow's own grid exactly as it was", () => {
    const mine = row({
      doer_id: "me", doer_name: "Me", can_fill_self: true, can_fill_override: false,
      can_evidence: true, can_blocker: true,
    });
    renderGrid({ grid: grid([mine]), canOverrideFill: false, owner: null });
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);
    // (More than one control mentions "Save" — the download buttons carry a
    // "Save your changes first" title while there are unsaved edits.)
    expect(screen.getAllByRole("button", { name: /^save/i }).length).toBeGreaterThan(0);
  });
});

describe("what the server would refuse is never offered", () => {
  it("cannot start a session when every row is already complete", () => {
    renderGrid({ grid: grid([row({ status: "done", lifecycle: "done" })]) });
    const btn = screen.getByRole("button", { name: /fill on behalf/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toMatch(/already complete/i);
  });

  it("can start when at least one row is still outstanding", () => {
    renderGrid({
      grid: grid([row({ record_id: "r1", status: "done", lifecycle: "done" }), row({ record_id: "r2" })]),
    });
    const btn = screen.getByRole("button", { name: /fill on behalf/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.title).toMatch(/1 outstanding row/i);
  });

  it("locks the already-complete rows inside a session and says why", async () => {
    renderGrid({
      grid: grid([row({ record_id: "r1", status: "done", lifecycle: "done" }), row({ record_id: "r2" })]),
    });
    await startSession();
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // Desktop table + mobile card render each row once: one complete, one outstanding.
    expect(boxes.filter((b) => b.disabled).length).toBeGreaterThan(0);
    expect(boxes.filter((b) => !b.disabled).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/does not rewrite finished work/i).length).toBeGreaterThan(0);
  });

  it("keeps a row the manager just ticked editable — the lock reads the saved status", async () => {
    renderGrid();
    await startSession();
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(box);
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });
});

describe("starting a session", () => {
  it("will not start without a reason", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /fill on behalf/i }));
    expect((screen.getByRole("button", { name: /start filling/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("names the person and warns that it is recorded", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /fill on behalf/i }));
    expect(screen.getByText(/fill on behalf of priya s/i)).toBeTruthy();
    expect(screen.getByText(/recorded in the task history/i)).toBeTruthy();
    // Promises only what the server actually does: the doer's manager is skipped when the
    // caller IS that manager.
    expect(screen.getByText(/along with their manager, if that is not you/i)).toBeTruthy();
  });

  it("unlocks the rows and keeps the reason on screen", async () => {
    renderGrid();
    await startSession("On emergency leave; confirmed by phone.");
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);
    expect(screen.getByText(/on emergency leave; confirmed by phone\./i)).toBeTruthy();
  });
});

describe("saving a session", () => {
  it("posts to the override endpoint carrying the reason, never the ordinary one", async () => {
    renderGrid();
    await startSession("Fellow unreachable since Monday.");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /save on behalf/i }));
    await waitFor(() => expect(overrideMutate).toHaveBeenCalledTimes(1));
    expect(overrideMutate).toHaveBeenCalledWith({
      reason: "Fellow unreachable since Monday.",
      edits: [{ record_id: "r1", values: {}, status: "done" }],
    });
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("keeps the manager's edits when the server refuses", async () => {
    overrideMutate.mockRejectedValueOnce(new Error("record r1 is already complete"));
    renderGrid();
    await startSession();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /save on behalf/i }));
    await waitFor(() => expect(screen.getByText(/already complete/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /save on behalf \(1\)/i })).toBeTruthy();
  });

  it("exiting discards the unsaved edits and re-locks the grid", async () => {
    renderGrid();
    await startSession();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /exit \(discards 1\)/i }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: /fill on behalf/i })).toBeTruthy();
  });
});

describe("what the session does NOT unlock", () => {
  it("no bulk upload — it posts to the ordinary batch route, which would be refused", async () => {
    renderGrid();
    expect(screen.queryByRole("button", { name: /bulk upload/i })).toBeNull();
    await startSession();
    expect(screen.queryByRole("button", { name: /bulk upload/i })).toBeNull();
  });

  it("no blocker raising — that stays the doer's own voice", async () => {
    renderGrid();
    await startSession();
    expect(screen.queryByPlaceholderText(/stuck/i)).toBeNull();
  });

  it("no proof capture — an override waives evidence, it does not manufacture it", async () => {
    renderGrid({ template: template({ require_photo: true, require_location: true }) });
    await startSession();
    expect(screen.queryByText(/add a photo/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /capture location/i })).toBeNull();
  });

  it("completes a row the proof gate would have blocked", async () => {
    renderGrid({ template: template({ require_photo: true }) });
    await startSession();
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.disabled).toBe(false);
  });

  it("reaches the done stage of a WORKFLOW task the gates would have blocked", async () => {
    renderGrid({
      template: template({
        completion_style: "workflow",
        workflow_statuses: ["todo", "doing", "verified"],
        done_status: "verified",
      }),
      grid: grid([row({ lifecycle: "overdue" })]),
    });
    await startSession();
    // The desktop table and the mobile card each render the select.
    const done = screen.getAllByRole("option", { name: "verified" }) as HTMLOptionElement[];
    expect(done.length).toBeGreaterThan(0);
    expect(done.every((o) => !o.disabled)).toBe(true);
  });

  it("stops telling the manager to go ask a manager for an extension", async () => {
    renderGrid({ grid: grid([row({ lifecycle: "overdue" })]) });
    expect(screen.getAllByText(/ask your zm or pm for an extension/i).length).toBeGreaterThan(0);
    await startSession();
    expect(screen.queryByText(/ask your zm or pm for an extension/i)).toBeNull();
    expect(screen.getAllByText(/waives its requirements/i).length).toBeGreaterThan(0);
  });
});

describe("session boundaries", () => {
  it("ends when the manager switches to another person", async () => {
    const { rerender } = renderGrid();
    await startSession();
    rerender(
      <TrackerEditableGrid
        template={template()}
        grid={grid()}
        canFill
        canClear={false}
          canOverrideFill
        owner={{ id: "f2", name: "Arun K" }}
      />,
    );
    expect(screen.queryByText(/filling as/i)).toBeNull();
    expect(screen.getByRole("button", { name: /fill on behalf/i })).toBeTruthy();
  });

  it("ends when the manager switches to another task", async () => {
    const { rerender } = renderGrid();
    await startSession();
    rerender(
      <TrackerEditableGrid
        template={template({ id: "t2" })}
        grid={grid()}
        canFill
        canClear={false}
          canOverrideFill
        owner={OWNER}
      />,
    );
    expect(screen.queryByText(/filling as/i)).toBeNull();
  });
});
