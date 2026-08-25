import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import type { Batch } from "@/lib/api";

/**
 * A batch must state where its attendance comes from, and it must be a real
 * choice — no default, because a default is not a decision and would quietly
 * file a cohort under the wrong store. Once attendance exists the answer is
 * frozen: changing it would rewrite marks that have already been made.
 */

const createBatch = vi.fn();
const updateBatch = vi.fn();

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  fetchSchools: async () => [],
  createBatch: (...a: unknown[]) => createBatch(...a),
  updateBatch: (...a: unknown[]) => updateBatch(...a),
}));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));
vi.mock("@/components/SchoolSearchPicker", () => ({
  SchoolSearchPicker: () => <div />,
}));

import { BatchFormModal } from "@/app/dashboard/batches/BatchFormModal";

function batch(over: Partial<Batch> = {}): Batch {
  return {
    id: "b1", name: "Grade 11", school_id: null, school_name: null,
    programme_type: "UG", delivery_mode: "SCHOOL_BASED", delivery_mode_locked: false,
    status: "ACTIVE", starts_on: null, ends_on: null, created_by: null,
    created_at: "2026-08-01T00:00:00.000Z",
    member_count: 0, course_count: 0, bundle_count: 0, test_count: 0,
    ...over,
  };
}

beforeEach(() => { createBatch.mockReset(); updateBatch.mockReset(); });

describe("creating a batch", () => {
  it("starts with no mode chosen", () => {
    const { getByLabelText } = render(
      <BatchFormModal mode="create" onClose={() => {}} onSaved={() => {}} />,
    );
    expect((getByLabelText("Attendance") as HTMLSelectElement).value).toBe("");
  });

  it("refuses to save until a mode is chosen, and sends nothing", async () => {
    const { getByRole, findByText } = render(
      <BatchFormModal mode="create" onClose={() => {}} onSaved={() => {}} />,
    );
    fireEvent.change(getByRole("textbox"), { target: { value: "CAT 2026" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    expect(await findByText(/online or school-based/i)).toBeTruthy();
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("sends the chosen mode", async () => {
    const { getByRole, getByLabelText } = render(
      <BatchFormModal mode="create" onClose={() => {}} onSaved={() => {}} />,
    );
    fireEvent.change(getByRole("textbox"), { target: { value: "CAT 2026" } });
    fireEvent.change(getByLabelText("Attendance"), { target: { value: "ONLINE" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createBatch).toHaveBeenCalled());
    expect(createBatch.mock.calls[0][0]).toMatchObject({ delivery_mode: "ONLINE" });
  });
});

describe("editing a batch", () => {
  it("shows the stored mode and lets it change while nothing depends on it", async () => {
    const { getByLabelText, getByRole } = render(
      <BatchFormModal mode="edit" batch={batch()} onClose={() => {}} onSaved={() => {}} />,
    );
    const select = getByLabelText("Attendance") as HTMLSelectElement;
    expect(select.value).toBe("SCHOOL_BASED");
    expect(select.disabled).toBe(false);

    fireEvent.change(select, { target: { value: "ONLINE" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalled());
    expect(updateBatch.mock.calls[0][1]).toMatchObject({ delivery_mode: "ONLINE" });
  });

  it("freezes the control once attendance history exists, and explains why", () => {
    const { getByLabelText, getByText } = render(
      <BatchFormModal
        mode="edit"
        batch={batch({ delivery_mode_locked: true })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect((getByLabelText("Attendance") as HTMLSelectElement).disabled).toBe(true);
    expect(getByText(/already has attendance history/i)).toBeTruthy();
  });

  it("does not send delivery_mode at all for a frozen batch", async () => {
    const { getByRole } = render(
      <BatchFormModal
        mode="edit"
        batch={batch({ delivery_mode_locked: true })}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalled());
    expect(updateBatch.mock.calls[0][1]).not.toHaveProperty("delivery_mode");
  });
});
