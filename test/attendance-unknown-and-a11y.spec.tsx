import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import type { ClassRosterView, MyAttendanceStats } from "@/lib/attendance-api";
import { DOMAIN_KEYS } from "@/lib/mutations/invalidation";

/**
 * Two themes the review surfaced, both about telling the truth.
 *
 * 1. UNKNOWN is missing evidence, not absence. Every place that divides by
 *    "everything on screen" instead of "everything recorded" turns a gap in the
 *    record into an accusation against the student.
 * 2. A dialog that only works with a mouse is not finished. These two are the
 *    only way into attendance detail, so keyboard users would be locked out.
 */

let roster: ClassRosterView;
let stats: MyAttendanceStats;

vi.mock("@/lib/queries/attendance", () => ({
  useClassRoster: () => ({ data: roster, isPending: false, error: null }),
  useMarkClassAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useMyAttendance: () => ({ data: stats, isLoading: false }),
}));

import { ClassRoster } from "@/app/dashboard/live-classes/_components/ClassRoster";
import { StudentView } from "@/app/dashboard/attendance/_components/StudentView";

const unknownRoster: ClassRosterView = {
  class: { id: "c1", title: "Maths", scheduled_at: "2026-08-11T04:30:00.000Z", attendance_mode: "SCHOOL_BASED" },
  can_mark: false,
  source: "REGISTER",
  note: "No register has been committed for 2026-08-11 yet.",
  rows: [
    { student_id: "s1", name: "Asha", email: null, school_name: null, status: "UNKNOWN", source: "NONE", joined_at: null, marked_at: null, marked_by_name: null },
    { student_id: "s2", name: "Bala", email: null, school_name: null, status: "UNKNOWN", source: "NONE", joined_at: null, marked_at: null, marked_by_name: null },
  ],
};

beforeEach(() => {
  roster = unknownRoster;
  stats = {
    from: "2026-06-01", to: "2026-08-24",
    series: [{
      mode: "SCHOOL_BASED",
      summary: { present: 0, marked: 0, total: 3, pct: 0 },
      truncated: false,
      entries: [
        { key: "reg:2026-08-11", kind: "REGISTER_DATE", label: "2026-08-11", at: "2026-08-11", status: "UNKNOWN", source: "NONE", marked_by_name: null },
      ],
    }],
    school_confirmations: { attended: 0, total: 0 },
    quizzes: { assigned: 0, completed: 0, items: [] },
  };
});

describe("nothing recorded is not everyone absent", () => {
  it("the roster header refuses to print 0/20", () => {
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    expect(screen.getByText(/Nothing recorded yet/i)).toBeTruthy();
    expect(screen.queryByText("0/2 present")).toBeNull();
  });

  it("the student card refuses to print 0%", () => {
    render(<StudentView />);
    expect(screen.getByText(/Nothing recorded yet/i)).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });
});

describe("the roster dialog is usable without a mouse", () => {
  it("has an accessible name taken from the class", () => {
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).toContain("Maths");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<ClassRoster liveClassId="c1" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("puts focus inside the dialog rather than leaving it on the page behind", () => {
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});

describe("writes bust the caches that now read the same rows", () => {
  it("marking attendance refreshes the canonical report, not just the roster", () => {
    expect(DOMAIN_KEYS.liveClassAttendance).toContainEqual(["og", "attendance"]);
  });

  it("a register commit refreshes the class rosters that render it", () => {
    expect(DOMAIN_KEYS.attendance).toContainEqual(["og", "live-classes"]);
  });

  it("scheduling or deleting a class refreshes the report it is an occasion in", () => {
    expect(DOMAIN_KEYS.calendar).toContainEqual(["og", "attendance"]);
  });

  it("membership changes refresh both the report and the rosters", () => {
    expect(DOMAIN_KEYS.batches).toContainEqual(["og", "attendance"]);
    expect(DOMAIN_KEYS.batches).toContainEqual(["og", "live-classes"]);
    expect(DOMAIN_KEYS.enrolment).toContainEqual(["og", "attendance"]);
  });
});
