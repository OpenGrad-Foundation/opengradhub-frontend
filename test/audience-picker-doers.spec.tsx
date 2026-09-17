import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const assignable = vi.fn();
vi.mock("@/lib/queries/tracker", () => ({
  useTrackerAssignable: (...args: unknown[]) => assignable(...args),
}));

import { AudiencePicker } from "@/app/dashboard/tracker/_components/audience-picker";

const staff = (id: string, name: string, role: string) =>
  ({ id, name, role, state: null, district: null, school_id: null, school_name: null, programmes: [] });

beforeEach(() => {
  vi.clearAllMocks();
  assignable.mockReturnValue({
    data: [staff("z1", "Ravi", "ZONAL_MANAGER"), staff("f1", "Anita", "FELLOW"), staff("f2", "Bala", "FELLOW")],
    isLoading: false,
  });
});

describe("AudiencePicker — who fills this in, independent of the Task Target", () => {
  it("always asks the server for the staff list", () => {
    render(<AudiencePicker canAuthor selected={new Set()} onChange={vi.fn()} />);
    expect(assignable).toHaveBeenCalledWith("fellow", true);
  });

  it("lists ZMs and in-charges by name and a tick is that person", () => {
    const onChange = vi.fn();
    render(<AudiencePicker canAuthor selected={new Set()} onChange={onChange} />);
    expect(screen.getByLabelText(/ravi/i)).toBeTruthy();
    expect(screen.getByLabelText(/anita/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/anita/i));
    expect(onChange).toHaveBeenCalledWith(new Set(["f1"]));
  });

  it("select all picks every listed person", () => {
    const onChange = vi.fn();
    render(<AudiencePicker canAuthor selected={new Set()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /select all 3/i }));
    expect(onChange).toHaveBeenCalledWith(new Set(["z1", "f1", "f2"]));
  });

  it("school filter keeps the people whose reach covers that school — the ZM above the in-charge too", () => {
    const cbe = { id: "s1", name: "GHSS Coimbatore" };
    const mdu = { id: "s2", name: "GHSS Madurai" };
    assignable.mockReturnValue({
      data: [
        { ...staff("z1", "Ravi", "ZONAL_MANAGER"), schools: [cbe, mdu] },
        { ...staff("f1", "Anita", "FELLOW"), schools: [cbe] },
        { ...staff("f2", "Bala", "FELLOW"), schools: [mdu] },
      ],
      isLoading: false,
    });
    render(<AudiencePicker canAuthor selected={new Set()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /all schools/i }));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "coim" } });
    expect(screen.queryByRole("button", { name: /ghss madurai/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ghss coimbatore/i }));
    expect(screen.getByLabelText(/ravi/i)).toBeTruthy();
    expect(screen.getByLabelText(/anita/i)).toBeTruthy();
    expect(screen.queryByLabelText(/bala/i)).toBeNull();
  });

  it("no school filter when nobody carries schools", () => {
    render(<AudiencePicker canAuthor selected={new Set()} onChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /all schools/i })).toBeNull();
  });

  it("counts picks hidden by a filter and keeps Clear reachable", () => {
    assignable.mockReturnValue({
      data: [{ ...staff("f1", "Anita", "FELLOW"), state: "KERALA" }, { ...staff("f2", "Bala", "FELLOW"), state: "TAMIL_NADU" }],
      isLoading: false,
    });
    const onChange = vi.fn();
    render(<AudiencePicker canAuthor selected={new Set(["f1"])} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^state/i), { target: { value: "TAMIL_NADU" } });
    expect(screen.getByText(/1 selected\. 1 hidden by the filters/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });
});
