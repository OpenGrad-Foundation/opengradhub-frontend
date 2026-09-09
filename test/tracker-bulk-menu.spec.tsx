import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

/**
 * The toolbar carries two different files — the manager's report and the doer's fill
 * template — and used to offer both as bare CSV buttons side by side. The fill template
 * now lives behind the Bulk fill menu, next to the upload it exists for.
 */

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
}));

const downloadGridTemplate = vi.fn<(name: string, columns: unknown, rows: unknown, format: string) => Promise<void>>();
vi.mock("@/lib/tracker-bulk-file", () => ({
  downloadGridTemplate: (name: string, columns: unknown, rows: unknown, format: string) =>
    downloadGridTemplate(name, columns, rows, format),
  downloadRows: vi.fn(),
  parseSheetFile: vi.fn(),
  SheetReadError: class extends Error {},
}));

import { TrackerEditableGrid } from "@/app/dashboard/tracker/_components/tracker-grid";

const template = {
  id: "t1", code: "VISIT", name: "School visit", description: null,
  target_type: "school", completion_style: "checklist", workflow_statuses: null,
  done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
  require_photo: false, require_location: false, require_geo_verification: false,
  status: "active",
} as TrackerTemplate;

const rows: TrackerGridRow[] = [{
  record_id: "r1", status: "not_started", cells: [], blocked: false, blocker: null,
  doer_id: "me", doer_name: "Me", can_fill_self: true, can_fill_override: false,
  can_evidence: true, can_blocker: true, fill_reason: null,
  school_name: "Govt HSS Coimbatore", school_id: "s1", target_name: null, lifecycle: "not_started",
} as TrackerGridRow];

const grid: TrackerGrid = { columns: [], rows };

const renderGrid = (props: Record<string, unknown> = {}) =>
  render(<TrackerEditableGrid template={template} grid={grid} canFill canClear={false} {...props} />);

beforeEach(() => downloadGridTemplate.mockClear());

describe("grid toolbar — bulk fill menu", () => {
  it("keeps the template downloads inside the Bulk fill menu until it is opened", () => {
    renderGrid();
    expect(screen.queryByRole("menuitem", { name: /CSV/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /bulk fill/i }));
    expect(screen.getByRole("menuitem", { name: /CSV/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Excel/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /upload/i })).toBeTruthy();
  });

  it("downloads the fill template in the chosen format and closes the menu", async () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /bulk fill/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Excel/i }));
    // The builder is loaded on demand, so the call lands a microtask later.
    await waitFor(() => expect(downloadGridTemplate).toHaveBeenCalledWith("School visit", [], rows, "xlsx"));
    expect(screen.queryByRole("menuitem", { name: /Excel/i })).toBeNull();
  });

  it("closes the menu on a click outside it", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /bulk fill/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menuitem", { name: /CSV/i })).toBeNull();
  });

  it("keeps the two export files inside their own menu", () => {
    renderGrid({ canExport: true });
    expect(screen.queryByRole("menuitem", { name: /history/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    expect(screen.getByRole("menuitem", { name: /records only/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /records \+ history/i })).toBeTruthy();
  });

  it("keeps the export and bulk fill menus independent", () => {
    renderGrid({ canExport: true });
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    fireEvent.click(screen.getByRole("button", { name: /bulk fill/i }));
    expect(screen.queryByRole("menuitem", { name: /records only/i })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /CSV/i })).toBeTruthy();
  });

  it("does not clip an open menu inside the grid card", () => {
    const { container } = renderGrid({ canExport: true });
    fireEvent.click(screen.getByRole("button", { name: /^export$/i }));
    // The menu is absolutely positioned, so ANY overflow-hidden ancestor inside the card
    // cuts it off at the toolbar's edge — z-index cannot rescue it.
    let node = screen.getByRole("menu").parentElement;
    while (node && node !== container) {
      expect(node.className).not.toMatch(/overflow-hidden/);
      node = node.parentElement;
    }
  });

  it("offers no bulk fill menu to someone who cannot fill these rows", () => {
    renderGrid({ canFill: false, canExport: true });
    expect(screen.queryByRole("button", { name: /bulk fill/i })).toBeNull();
  });
});
