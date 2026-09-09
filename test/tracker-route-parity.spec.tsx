import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TrackerGrid, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

/**
 * The tracker reaches one grid four ways: the team roster drill (which knows whose rows it
 * opened), the `?task=` deep link from a student profile, the Overview status card, and the
 * embedded template grid. Only the first ever set an owner, and authority used to follow
 * that — so the other three offered editable cells the server refused. The row's own
 * capabilities must now decide, identically, on every route.
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

import { TrackerEditableGrid } from "@/app/dashboard/tracker/_components/tracker-grid";

const template: TrackerTemplate = ({
  id: "t1", code: "VISIT", name: "School visit", description: null,
  target_type: "student", completion_style: "checklist", workflow_statuses: null,
  done_status: null, deadline: null, priority: "medium", recurrence_frequency: null,
  require_photo: false, require_location: false, require_geo_verification: false,
  status: "active",
}) as TrackerTemplate;

const theirs = {
  record_id: "a1", status: "not_started", cells: [], blocked: false, blocker: null,
  school_name: null, school_id: null, target_name: "A student", lifecycle: "not_started",
  doer_id: "A", doer_name: "Asha",
  can_fill_self: false, can_fill_override: true, can_evidence: false, can_blocker: false,
  fill_reason: null,
} as unknown as TrackerGridRow;

const grid: TrackerGrid = { columns: [], rows: [theirs] };

/** The props each route hands the grid today. */
const ROUTES: Array<[string, Partial<React.ComponentProps<typeof TrackerEditableGrid>>]> = [
  ["roster drill", { owner: { id: "A", name: "Asha" } }],
  ["?task= deep link", { owner: null }],
  ["overview status card", { owner: null }],
  ["embedded template grid", { owner: null, embedded: true } as never],
];

describe("every route into a task grid", () => {
  it.each(ROUTES)("treats a subordinate's row the same way from the %s", (_name, props) => {
    render(
      <TrackerEditableGrid template={template} grid={grid} canFill canClear={false}
        canOverrideFill {...props} />,
    );
    // Read-only until the manager opts in...
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).every((b) => b.disabled)).toBe(true);
    // ...and the opt-in is offered, which is what the ownerless routes used to lack.
    expect((screen.getByRole("button", { name: /fill on behalf/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it.each(ROUTES)("offers no override to a viewer without the permission (%s)", (_name, props) => {
    render(
      <TrackerEditableGrid template={template} grid={grid} canFill canClear={false}
        canOverrideFill={false} {...props} />,
    );
    expect(screen.queryByRole("button", { name: /fill on behalf/i })).toBeNull();
    expect((screen.getAllByRole("checkbox") as HTMLInputElement[]).every((b) => b.disabled)).toBe(true);
  });
});
