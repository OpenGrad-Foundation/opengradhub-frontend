import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

/**
 * A mixed grid saves through two endpoints: the ordinary batch for the viewer's own rows,
 * and the override batch once per doer for everyone else's. One refusal must not discard
 * another group's work.
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

const template: TrackerTemplate = ({
  id: "t1", code: "VISIT", name: "School visit", description: null,
  target_type: "student", completion_style: "checklist", workflow_statuses: null,
  done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
  require_photo: false, require_location: false, require_geo_verification: false,
  status: "active",
}) as TrackerTemplate;

const base = {
  status: "not_started", cells: [], blocked: false, blocker: null,
  school_name: null, school_id: null, lifecycle: "not_started",
} as unknown as TrackerGridRow;

const mine = { ...base, record_id: "own", target_name: "Mine", doer_id: "me", doer_name: "Me",
  can_fill_self: true, can_fill_override: false, can_evidence: true, can_blocker: true } as TrackerGridRow;
const asha1 = { ...base, record_id: "a1", target_name: "Asha one", doer_id: "A", doer_name: "Asha",
  can_fill_self: false, can_fill_override: true, can_evidence: false, can_blocker: false } as TrackerGridRow;
const asha2 = { ...asha1, record_id: "a2", target_name: "Asha two" } as TrackerGridRow;
const bala = { ...asha1, record_id: "b1", target_name: "Bala one", doer_id: "B", doer_name: "Bala" } as TrackerGridRow;

const grid = (rows: TrackerGridRow[]): TrackerGrid => ({ columns: [], rows });

function renderGrid(rows: TrackerGridRow[]) {
  return render(
    <TrackerEditableGrid template={template} grid={grid(rows)} canFill canClear={false}
      owner={null} canOverrideFill />,
  );
}

/** Tick the desktop-table checkbox of one row. */
function tick(label: string) {
  const box = (screen.getAllByRole("checkbox") as HTMLInputElement[])
    .find((b) => b.closest("tr")?.textContent?.includes(label));
  if (!box) throw new Error(`no row control for ${label}`);
  fireEvent.click(box);
}

async function startSession(reason = "Both are on leave; visits confirmed by phone.") {
  fireEvent.click(screen.getByRole("button", { name: /fill on behalf/i }));
  fireEvent.change(screen.getByRole("textbox", { name: /why are you filling/i }), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: /start filling/i }));
  await waitFor(() => expect(screen.getByText(/recorded in this task's history/i)).toBeTruthy());
}

/** The toolbar's Save, not the per-row blocker's. */
const saveButton = () => {
  const btn = (screen.getAllByRole("button") as HTMLButtonElement[])
    .find((b) => /^save/i.test(b.textContent ?? "") && b.className.includes("bg-teal-600"));
  if (!btn) throw new Error("no toolbar save button");
  return btn;
};

beforeEach(() => {
  saveMutate.mockReset().mockResolvedValue({ saved: 1 });
  overrideMutate.mockReset().mockResolvedValue({ saved: 1 });
});

describe("saving a mixed grid", () => {
  it("sends own rows ordinarily and one override request per doer, sharing the reason", async () => {
    renderGrid([mine, asha1, asha2, bala]);
    await startSession("Both are on leave; visits confirmed by phone.");
    tick("Mine"); tick("Asha one"); tick("Asha two"); tick("Bala one");
    fireEvent.click(saveButton());

    await waitFor(() => expect(overrideMutate).toHaveBeenCalledTimes(2));
    expect(saveMutate).toHaveBeenCalledTimes(1);
    expect(saveMutate.mock.calls[0][0]).toEqual([{ record_id: "own", values: {}, status: "done" }]);
    // One doer per request, as the override endpoint requires.
    expect(overrideMutate.mock.calls[0][0]).toEqual({
      reason: "Both are on leave; visits confirmed by phone.",
      edits: [
        { record_id: "a1", values: {}, status: "done" },
        { record_id: "a2", values: {}, status: "done" },
      ],
    });
    expect(overrideMutate.mock.calls[1][0].edits).toEqual([{ record_id: "b1", values: {}, status: "done" }]);
  });

  it("keeps the refused group's drafts, names the person, and clears the rest", async () => {
    overrideMutate
      .mockResolvedValueOnce({ saved: 2 })
      .mockRejectedValueOnce(new Error("record b1 is already complete"));
    renderGrid([mine, asha1, bala]);
    await startSession();
    tick("Mine"); tick("Asha one"); tick("Bala one");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(/bala's rows/i)).toBeTruthy());
    expect(screen.getByText(/already complete/i)).toBeTruthy();
    // Only Bala's row is still dirty.
    expect(saveButton().textContent).toMatch(/save on behalf \(1\)/i);
  });

  it("reports its own rows separately when only they are refused", async () => {
    saveMutate.mockRejectedValueOnce(new Error("record own not found"));
    renderGrid([mine, asha1]);
    await startSession();
    tick("Mine"); tick("Asha one");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(/your own rows/i)).toBeTruthy());
    expect(overrideMutate).toHaveBeenCalledTimes(1);
    expect(saveButton().textContent).toMatch(/save on behalf \(1\)/i);
  });

  it("exiting the session discards only what was typed in someone else's name", async () => {
    renderGrid([mine, asha1]);
    await startSession();
    tick("Mine"); tick("Asha one");
    expect(screen.getByRole("button", { name: /exit \(discards 1\)/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /exit/i }));
    // The own-row edit survives and is still saveable on the ordinary route.
    await waitFor(() => expect(saveButton().textContent).toMatch(/^save \(1\)/i));
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(saveMutate.mock.calls[0][0]).toEqual([{ record_id: "own", values: {}, status: "done" }]);
  });

  it("discards an admin's on-behalf edit on exit, even though they could fill it ordinarily", async () => {
    const admin = { ...asha1, record_id: "adm", target_name: "Admin row", can_fill_self: true } as TrackerGridRow;
    renderGrid([admin]);
    await startSession();
    tick("Admin row");
    expect(screen.getByRole("button", { name: /exit \(discards 1\)/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /exit/i }));
    // Nothing left to save: the edit belonged to the session, not to the ordinary route.
    await waitFor(() => expect(saveButton().textContent).not.toMatch(/\(1\)/));
    fireEvent.click(saveButton());
    expect(saveMutate).not.toHaveBeenCalled();
  });

  it("keeps an edit typed while the save is still in flight", async () => {
    let release: (v: unknown) => void = () => {};
    saveMutate.mockImplementationOnce(() => new Promise((res) => { release = res; }));
    renderGrid([mine]);
    tick("Mine");                       // draft A: done
    fireEvent.click(saveButton());
    tick("Mine");                       // draft B: back to not_started, never submitted
    release({ saved: 1 });
    // The acknowledged version was A; B is newer and must survive rather than be cleared.
    await waitFor(() => expect(saveButton().textContent).toMatch(/save \(1\)/i));
  });

  it("saves own rows outside any session, on a grid that also holds foreign rows", async () => {
    renderGrid([mine, asha1]);
    tick("Mine");
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1));
    expect(overrideMutate).not.toHaveBeenCalled();
  });
});
