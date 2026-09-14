import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const assignable = vi.fn();
vi.mock("@/lib/queries/tracker", () => ({
  useTrackerAssignable: (...args: unknown[]) => assignable(...args),
}));

import { AudiencePicker } from "@/app/dashboard/tracker/_components/audience-picker";

const row = (id: string, name: string, role: string) => ({ id, name, role, state: null, district: null, school_id: null, school_name: null, programmes: [] });

beforeEach(() => {
  vi.clearAllMocks();
  assignable.mockReturnValue({ data: [row("z1", "Ravi", "ZONAL_MANAGER"), row("z2", "Meera", "ZONAL_MANAGER"), row("f1", "Anita", "FELLOW")], isLoading: false });
});

describe("AudiencePicker — role chips", () => {
  it("one click selects everyone with that role", () => {
    const onChange = vi.fn();
    render(<AudiencePicker targetType="fellow" canAuthor selected={new Set()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /all zonal managers/i }));
    expect(onChange).toHaveBeenCalledWith(new Set(["z1", "z2"]));
  });
  it("no chips when the list has a single role", () => {
    assignable.mockReturnValue({ data: [row("f1", "Anita", "FELLOW")], isLoading: false });
    render(<AudiencePicker targetType="fellow" canAuthor selected={new Set()} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^all school in-charges/i })).toBeNull();
  });
});
