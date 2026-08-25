import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { ClassRosterView } from "@/lib/attendance-api";

/**
 * One roster view for both kinds of class. What it lets you do is decided by
 * the CLASS, not by who opened it: an online class is markable, a school-based
 * one is answered by the committed register and must be read-only — otherwise
 * a correction here would compete with the register for the same fact.
 */

let roster: ClassRosterView;
const mutateAsync = vi.fn();

vi.mock("@/lib/queries/attendance", () => ({
  useClassRoster: () => ({ data: roster, isPending: false, error: null }),
  useMarkClassAttendance: () => ({ mutateAsync, isPending: false }),
}));

import { ClassRoster } from "@/app/dashboard/live-classes/_components/ClassRoster";

function view(over: Partial<ClassRosterView> = {}): ClassRosterView {
  return {
    class: { id: "c1", title: "Algebra L3", scheduled_at: "2026-08-11T10:00:00.000Z", attendance_mode: "ONLINE" },
    can_mark: true,
    source: "JOIN",
    note: null,
    rows: [
      { student_id: "s1", name: "Asha", email: null, school_name: "GHSS", status: "PRESENT", source: "JOIN", joined_at: "2026-08-11T10:01:00.000Z", marked_at: null, marked_by_name: null },
      { student_id: "s2", name: "Bala", email: null, school_name: "GHSS", status: "ABSENT", source: "NONE", joined_at: null, marked_at: null, marked_by_name: null },
    ],
    ...over,
  };
}

beforeEach(() => { mutateAsync.mockReset(); roster = view(); });

describe("ClassRoster — an ONLINE class", () => {
  it("says the mark comes from joining, and offers to save corrections", () => {
    const { getByText, getByRole } = render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    expect(getByText(/Marked by joining the class/i)).toBeTruthy();
    expect(getByRole("button", { name: /^Save$/ })).toBeTruthy();
  });

  it("sends only the rows actually changed", async () => {
    const { getByText, getByRole } = render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    fireEvent.click(getByText("Bala"));
    fireEvent.click(getByRole("button", { name: /Save \(1\)/ }));
    expect(mutateAsync).toHaveBeenCalledWith({
      liveClassId: "c1",
      marks: [{ student_id: "s2", status: "PRESENT" }],
    });
  });

  it("cannot be saved twice with nothing pending", () => {
    const { getByRole } = render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    const save = getByRole("button", { name: /^Save$/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });
});

describe("ClassRoster — a SCHOOL_BASED class", () => {
  beforeEach(() => {
    roster = view({
      class: { id: "c2", title: "Maths", scheduled_at: "2026-08-11T04:30:00.000Z", attendance_mode: "SCHOOL_BASED" },
      can_mark: false,
      source: "REGISTER",
      note: "From the school register for 2026-08-11.",
      rows: [
        { student_id: "s1", name: "Asha", email: null, school_name: "GHSS", status: "PRESENT", source: "REGISTER", joined_at: null, marked_at: null, marked_by_name: null },
        { student_id: "s3", name: "Chitra", email: null, school_name: "GHSS", status: "UNKNOWN", source: "NONE", joined_at: null, marked_at: null, marked_by_name: null },
      ],
    });
  });

  it("explains where the answer comes from and offers no way to change it", () => {
    const { getAllByText, queryByRole } = render(<ClassRoster liveClassId="c2" onClose={() => {}} />);
    // Once in the header note, once as a row's provenance line.
    expect(getAllByText(/From the school register/i).length).toBeGreaterThan(0);
    expect(queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("does not write anything when a row is clicked", () => {
    const { getByText } = render(<ClassRoster liveClassId="c2" onClose={() => {}} />);
    fireEvent.click(getByText("Asha"));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("shows a student the register never covered as not recorded, never absent", () => {
    const { getByText } = render(<ClassRoster liveClassId="c2" onClose={() => {}} />);
    // Chitra's own chip — not the filter button that shares the label.
    const chip = getByText("Chitra").closest("button")!.querySelector("span");
    expect(chip?.textContent).toBe("Not recorded");
  });
});

describe("ClassRoster — a class whose source was never resolved", () => {
  it("says so instead of inventing an answer", () => {
    roster = view({
      class: { id: "c3", title: "Legacy", scheduled_at: "2026-08-11T10:00:00.000Z", attendance_mode: null },
      can_mark: false,
      source: "NONE",
      note: "Attendance source not set for this class — edit its targets to fix.",
      rows: [{ student_id: "s1", name: "Asha", email: null, school_name: null, status: "UNKNOWN", source: "NONE", joined_at: null, marked_at: null, marked_by_name: null }],
    });
    const { getByText, queryByRole } = render(<ClassRoster liveClassId="c3" onClose={() => {}} />);
    expect(getByText(/Attendance source not set/i)).toBeTruthy();
    expect(queryByRole("button", { name: /Save/ })).toBeNull();
  });
});
