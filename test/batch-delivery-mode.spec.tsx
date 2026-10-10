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
  fetchSchools: async () => [{ id: "s1", name: "Kerala High" }, { id: "s2", name: "Delhi Public" }],
  createBatch: (...a: unknown[]) => createBatch(...a),
  updateBatch: (...a: unknown[]) => updateBatch(...a),
}));
vi.mock("@/lib/queries/programmes", () => ({
  useProgrammes: () => ({ data: [{ id: "p1", name: "UG Kerala", kind: "UG" }, { id: "p2", name: "PG Delhi", kind: "PG" }] }),
  useProgrammeSchools: (id?: string) => ({ data: id === "p2" ? [{ school_id: "s2", name: "Delhi Public" }] : undefined }),
}));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));
vi.mock("@/components/SchoolSearchPicker", () => ({
  SchoolSearchPicker: ({ schools }: { schools: { name: string }[] }) => <div data-testid="schools">{schools.map((s) => s.name).join(",")}</div>,
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

  // The API scopes creation by programme_id; a bare UG/PG kind was a 403 for
  // anyone holding more than one programme.
  it("sends the chosen programme's id", async () => {
    const { getByRole, getByLabelText } = render(
      <BatchFormModal mode="create" onClose={() => {}} onSaved={() => {}} />,
    );
    fireEvent.change(getByRole("textbox"), { target: { value: "PG 2026" } });
    fireEvent.change(getByLabelText("Attendance"), { target: { value: "ONLINE" } });
    fireEvent.change(getByLabelText("Programme"), { target: { value: "p2" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(createBatch).toHaveBeenCalled());
    expect(createBatch.mock.calls[0][0]).toMatchObject({ programme_id: "p2" });
  });

  it("offers only the schools the chosen programme hosts", async () => {
    const { getByLabelText, findByTestId } = render(
      <BatchFormModal mode="create" onClose={() => {}} onSaved={() => {}} />,
    );
    await waitFor(async () => expect((await findByTestId("schools")).textContent).toBe("Kerala High,Delhi Public"));
    fireEvent.change(getByLabelText("Programme"), { target: { value: "p2" } });
    expect((await findByTestId("schools")).textContent).toBe("Delhi Public");
  });
});

describe("programme and kind on edit", () => {
  // The edit list can be only the caller's slice of the programme; clearing a
  // school missing from it would detach the batch on save.
  it("keeps a school the programme list does not show, and sends no kind for a programme batch", async () => {
    const { getByRole } = render(
      <BatchFormModal mode="edit" batch={batch({ programme_id: "p2", school_id: "s1" })} onClose={() => {}} onSaved={() => {}} />,
    );
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalled());
    expect(updateBatch.mock.calls[0][1]).toMatchObject({ school_id: "s1" });
    expect(updateBatch.mock.calls[0][1]).not.toHaveProperty("programme_type");
  });

  it("still lets a programme-less batch change its kind", async () => {
    const { getByRole, getByLabelText } = render(
      <BatchFormModal mode="edit" batch={batch()} onClose={() => {}} onSaved={() => {}} />,
    );
    fireEvent.change(getByLabelText("Kind"), { target: { value: "PG" } });
    fireEvent.click(getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalled());
    expect(updateBatch.mock.calls[0][1]).toMatchObject({ programme_type: "PG" });
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
