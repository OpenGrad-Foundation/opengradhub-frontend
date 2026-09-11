import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const team = vi.fn();
const fellowTasks = vi.fn();
const fellows = vi.fn();
vi.mock("@/lib/queries/tracker", () => ({
  useTrackerTeam: (managerId: string | null, enabled = true) => team(managerId, enabled),
  useTrackerFellowTasks: (id?: string) => fellowTasks(id),
  useTrackerFellows: () => fellows(),
  useNudge: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-permission", () => ({ usePermissions: () => ({ has: () => true, isLoading: false }) }));
vi.mock("@/lib/mutations/invalidation", () => ({ useInvalidate: () => vi.fn() }));

import { TeamView } from "@/app/dashboard/tracker/_components/team-view";

const PM = { id: "pm1", name: "Priya PM", role: "PROGRAM_MANAGER", report_count: 2, own_total: 3, own_done: 2, own_pending: 1, last_nudged_all_at: null };
const ZM = { id: "zm1", name: "Ravi ZM", role: "ZONAL_MANAGER", report_count: 1, own_total: 0, own_done: 0, own_pending: 0, last_nudged_all_at: null };
const IC = { id: "ic1", name: "Anita IC", role: "FELLOW", report_count: 0, own_total: 8, own_done: 6, own_pending: 2, last_nudged_all_at: null };

beforeEach(() => {
  vi.clearAllMocks();
  fellowTasks.mockReturnValue({ data: [], isLoading: false });
  fellows.mockReturnValue({ data: [], isLoading: false });
  team.mockImplementation((managerId: string | null) => {
    if (managerId === null) return { data: [PM, ZM, IC], isLoading: false };
    if (managerId === "zm1") return { data: [IC], isLoading: false };
    return { data: [], isLoading: false };
  });
});

describe("TeamView — by-team drill", () => {
  it("renders the root with a role badge on every row", () => {
    render(<TeamView onOpen={vi.fn()} />);
    expect(screen.getByText("Priya PM")).toBeTruthy();
    expect(screen.getByText("Ravi ZM")).toBeTruthy();
    expect(screen.getByText("Anita IC")).toBeTruthy();
    expect(screen.getAllByText(/program manager/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/zonal manager/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/school in-charge/i).length).toBeGreaterThan(0);
  });

  it("drills into a manager: shows their own tasks and their reports, with a breadcrumb", () => {
    render(<TeamView onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Ravi ZM/ }));
    expect(team).toHaveBeenCalledWith("zm1", true);
    expect(screen.getByText(/Ravi ZM.s own tasks/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Anita IC/ })).toBeTruthy();
    // Breadcrumb: root › Ravi
    expect(screen.getByRole("button", { name: /^Your team$/ })).toBeTruthy();
  });

  it("opening someone with no reports goes straight to their task list", () => {
    render(<TeamView onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Anita IC/ }));
    expect(fellowTasks).toHaveBeenCalledWith("ic1");
    expect(screen.getByText(/Anita IC.s tasks/)).toBeTruthy();
    expect(screen.queryByText(/own tasks/)).toBeNull();
  });

  it("breadcrumb root click returns to the root list", () => {
    render(<TeamView onOpen={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Ravi ZM/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Your team$/ }));
    expect(screen.getByText("Priya PM")).toBeTruthy();
  });

  it("filters the current level by name and role", () => {
    render(<TeamView onOpen={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "anita" } });
    expect(screen.queryByText("Priya PM")).toBeNull();
    expect(screen.getByText("Anita IC")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: "ZONAL_MANAGER" } });
    expect(screen.queryByText("Priya PM")).toBeNull();
    expect(screen.getByText("Ravi ZM")).toBeTruthy();
  });

  it("?owner deep link opens that person's tasks directly", () => {
    fellows.mockReturnValue({ data: [{ id: "ic1", name: "Anita IC" }], isLoading: false });
    render(<TeamView onOpen={vi.fn()} initialOwnerId="ic1" />);
    expect(screen.getByText(/Anita IC.s tasks/)).toBeTruthy();
  });
});
