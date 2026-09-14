import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/queries/tracker", () => ({
  useProfilePaths: () => ({ data: { paths: [] } }),
  useTrackerAssignable: () => ({ data: [{ id: "zm1", name: "Ravi", role: "ZONAL_MANAGER", state: null, programmes: [] }], isLoading: false }),
  useTrackerMyProgrammes: () => ({ data: [] }),
}));
vi.mock("@/lib/queries/batches", () => ({ useBatches: () => ({ data: [] }) }));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));
vi.mock("@/lib/tracker-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tracker-api")>()),
  createTrackerTemplate: vi.fn().mockResolvedValue({ id: "t1" }),
  addTrackerFields: vi.fn().mockResolvedValue({}),
  assignTrackerTargets: vi.fn().mockResolvedValue({ created: 1, skipped: 1 }),
}));

import { TrackerBuilder } from "@/app/dashboard/tracker/_components/tracker-builder";

describe("TrackerBuilder — assignment the server refused", () => {
  it("says how many picks were not assigned instead of a bare 'Created'", async () => {
    // pm1 arrives via prefill (e.g. an old Assign-task link) and is not in the list.
    render(<TrackerBuilder canAuthor prefill={{ targetType: "fellow", ids: ["zm1", "pm1"] }} />);
    fireEvent.change(screen.getByPlaceholderText("Monthly Report"), { target: { value: "Visit" } });
    fireEvent.click(screen.getByRole("button", { name: /create & publish/i }));
    await waitFor(() => expect(screen.getByText(/assigned to 1 staff\. 1 of the 2 picked could not be assigned/i)).toBeTruthy());
  });
});
