import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackerField, TrackerGridRow, TrackerTemplate } from "@/lib/tracker-api";

/**
 * Bulk upload inside a fill-on-behalf session: the viewer's own rows take the ordinary route,
 * everyone else's go to the override route — one doer per request, with the session's reason.
 */

const saveBatch = vi.fn().mockResolvedValue({ saved: 1 });
const saveOnBehalf = vi.fn().mockResolvedValue({ saved: 1 });
const sheet = vi.fn();

vi.mock("@/lib/tracker-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracker-api")>()),
  saveTrackerBatch: (...a: unknown[]) => saveBatch(...a),
  saveTrackerBatchOnBehalf: (...a: unknown[]) => saveOnBehalf(...a),
}));
vi.mock("@/lib/tracker-bulk-file", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracker-bulk-file")>()),
  parseSheetFile: () => sheet(),
}));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => () => {} }));

import { TrackerBulkUploadPanel } from "@/app/dashboard/tracker/_components/tracker-bulk-upload-panel";

const template = { id: "t1", code: "VISIT", name: "School visit" } as TrackerTemplate;
const columns = [{ field_key: "visited", label: "Visited", field_type: "checkbox" }] as unknown as TrackerField[];

const row = (id: string, over: Partial<TrackerGridRow>): TrackerGridRow =>
  ({
    record_id: id, status: "not_started", blocked: false, blocker: null,
    school_name: null, school_id: null, target_name: id, lifecycle: "not_started",
    cells: [{ field_key: "visited", value: null, notSet: true }],
    can_fill_self: false, can_fill_override: true, can_evidence: false, can_blocker: false,
    ...over,
  }) as TrackerGridRow;

const rows = [
  row("mine", { doer_id: "me", doer_name: "Me", can_fill_self: true, can_fill_override: false }),
  row("a1", { doer_id: "f1", doer_name: "Asha" }),
  row("a2", { doer_id: "f1", doer_name: "Asha" }),
  row("b1", { doer_id: "f2", doer_name: "Bala" }),
];

beforeEach(() => {
  saveBatch.mockClear();
  saveOnBehalf.mockClear();
  sheet.mockResolvedValue({
    headers: ["record_id", "Visited"],
    rows: rows.map((r) => ({ record_id: r.record_id, Visited: "yes" })),
  });
});

async function upload(props: Partial<React.ComponentProps<typeof TrackerBulkUploadPanel>>) {
  const { container } = render(
    <TrackerBulkUploadPanel template={template} columns={columns} rows={rows} onClose={() => {}} {...props} />,
  );
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "filled.csv")] } });
  fireEvent.click(await screen.findByRole("button", { name: /upload 4 rows/i }));
  await waitFor(() => expect(screen.getByText(/4 rows saved/i)).toBeTruthy());
}

describe("bulk upload on behalf", () => {
  it("routes own rows to the ordinary save and each doer's rows to the override, with the reason", async () => {
    await upload({ onBehalfReason: "On leave", onBehalfLabel: "2 team members" });
    expect(screen.getByText(/filling as 2 team members/i)).toBeTruthy();
    expect(saveBatch).toHaveBeenCalledTimes(1);
    expect(saveBatch.mock.calls[0][0].map((e: { record_id: string }) => e.record_id)).toEqual(["mine"]);
    const calls = saveOnBehalf.mock.calls.map(([reason, edits]) => [reason, edits.map((e: { record_id: string }) => e.record_id)]);
    expect(calls).toEqual([["On leave", ["a1", "a2"]], ["On leave", ["b1"]]]);
  });

  it("outside a session everything goes the ordinary route", async () => {
    await upload({});
    expect(saveOnBehalf).not.toHaveBeenCalled();
    expect(saveBatch.mock.calls[0][0]).toHaveLength(4);
  });
});
