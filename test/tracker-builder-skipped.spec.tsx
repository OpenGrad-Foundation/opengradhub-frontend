import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/queries/tracker", () => ({
  useProfilePaths: () => ({ data: { paths: [] } }),
  useTrackerAssignable: (t: string) => ({
    data: t === "school" ? [] : [{ id: "zm1", name: "Ravi", role: "ZONAL_MANAGER", state: null, programmes: [] }],
    isLoading: false,
  }),
  useTrackerMyProgrammes: () => ({ data: [] }),
}));
vi.mock("@/lib/queries/batches", () => ({ useBatches: () => ({ data: [] }) }));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));
const assignDoers = vi.fn().mockResolvedValue({ created: 1, skipped: 1 });
vi.mock("@/lib/tracker-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracker-api")>()),
  createTrackerTemplate: vi.fn().mockResolvedValue({ id: "t1" }),
  addTrackerFields: vi.fn().mockResolvedValue({}),
  assignTrackerDoers: (...a: unknown[]) => assignDoers(...a),
}));

import { TrackerBuilder } from "@/app/dashboard/tracker/_components/tracker-builder";

describe("TrackerBuilder — who fills this in", () => {
  it("sends the picked people as doers and says how many could not be assigned", async () => {
    // pm1 arrives via prefill (e.g. an old Assign-task link) and is not in the list.
    render(<TrackerBuilder canAuthor prefill={{ targetType: "fellow", ids: ["zm1", "pm1"] }} />);
    fireEvent.change(screen.getByPlaceholderText("Monthly Report"), { target: { value: "Visit" } });
    fireEvent.click(screen.getByRole("button", { name: /create & publish/i }));
    await waitFor(() => expect(screen.getByText(/assigned to 1 staff\. 1 of the 2 people picked could not be assigned/i)).toBeTruthy());
    expect(assignDoers).toHaveBeenCalledWith("t1", ["zm1", "pm1"], { schoolIds: [], batchIds: [] });
  });

  it("a school task still picks people, and reports entries rather than people", async () => {
    assignDoers.mockResolvedValueOnce({ created: 4, skipped: 0 });
    render(<TrackerBuilder canAuthor prefill={{ targetType: "school", ids: ["zm1"] }} />);
    fireEvent.change(screen.getByPlaceholderText("Monthly Report"), { target: { value: "Visit" } });
    expect(screen.getByLabelText(/ravi/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /create & publish/i }));
    await waitFor(() => expect(screen.getByText(/assigned 4 school entries/i)).toBeTruthy());
    expect(assignDoers).toHaveBeenLastCalledWith("t1", ["zm1"], { schoolIds: [], batchIds: [] });
  });
});
