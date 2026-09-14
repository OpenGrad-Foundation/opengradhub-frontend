import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const assignable = vi.fn();
vi.mock("@/lib/queries/tracker", () => ({
  useTrackerAssignable: (...args: unknown[]) => assignable(...args),
}));

import { AudiencePicker } from "@/app/dashboard/tracker/_components/audience-picker";

const school = (id: string, doer_id: string | null, doer_name: string | null) =>
  ({ id, name: `School ${id}`, state: null, district: null, programmes: [], doer_id, doer_name });

beforeEach(() => {
  vi.clearAllMocks();
  assignable.mockReturnValue({
    data: [school("s1", "f1", "Anita"), school("s2", "f1", "Anita"), school("s3", "f2", "Bala"), school("s4", null, null)],
    isLoading: false,
  });
});

describe("AudiencePicker — school task picks by in-charge", () => {
  it("lists in-charges, not schools", () => {
    render(<AudiencePicker targetType="school" canAuthor selected={new Set()} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/anita/i)).toBeTruthy();
    expect(screen.getByLabelText(/bala/i)).toBeTruthy();
    expect(screen.queryByLabelText(/school s1/i)).toBeNull();
    expect(screen.getByText(/1 school with no school in-charge/i)).toBeTruthy();
  });

  it("ticking an in-charge selects every school they run", () => {
    const onChange = vi.fn();
    render(<AudiencePicker targetType="school" canAuthor selected={new Set()} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/anita/i));
    expect(onChange).toHaveBeenCalledWith(new Set(["s1", "s2"]));
  });

  it("select all skips schools nobody owns", () => {
    const onChange = vi.fn();
    render(<AudiencePicker targetType="school" canAuthor selected={new Set()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /select all 2/i }));
    expect(onChange).toHaveBeenCalledWith(new Set(["s1", "s2", "s3"]));
  });

  it("unticking a fully selected in-charge clears their schools", () => {
    const onChange = vi.fn();
    render(<AudiencePicker targetType="school" canAuthor selected={new Set(["s1", "s2", "s3"])} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/anita/i));
    expect(onChange).toHaveBeenCalledWith(new Set(["s3"]));
  });

  it("counts picks hidden by a filter and keeps Clear reachable", () => {
    assignable.mockReturnValue({
      data: [
        { ...school("s1", "f1", "Anita"), state: "KERALA" },
        { ...school("s3", "f2", "Bala"), state: "TAMIL_NADU" },
      ],
      isLoading: false,
    });
    const onChange = vi.fn();
    render(<AudiencePicker targetType="school" canAuthor selected={new Set(["s1"])} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^state/i), { target: { value: "TAMIL_NADU" } });
    expect(screen.getByText(/1 school in-charge · 1 school selected\. 1 hidden by the filters/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onChange).toHaveBeenCalledWith(new Set());
  });
});
