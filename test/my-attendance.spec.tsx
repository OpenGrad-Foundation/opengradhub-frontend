import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { MyAttendanceStats } from "@/lib/attendance-api";

/**
 * A student's own attendance, from the same canonical API staff read.
 *
 * Two things are being pinned. First, no backend vocabulary reaches a student —
 * AUTO / MANUAL / DERIVED / "register stream" are how the system stores things,
 * not how a student thinks about being present. Second, the whole-school
 * confirmation stays visibly separate: it is a fact about the school, and
 * letting it sit unlabelled next to a personal percentage is exactly the
 * confusion this consolidation set out to remove.
 */

let stats: MyAttendanceStats | undefined;

vi.mock("@/lib/queries/attendance", () => ({
  useMyAttendance: () => ({ data: stats, isLoading: false }),
}));

import { StudentView } from "@/app/dashboard/attendance/_components/StudentView";

const base: MyAttendanceStats = {
  from: "2026-06-01",
  to: "2026-08-24",
  series: [
    {
      mode: "SCHOOL_BASED",
      summary: { present: 17, marked: 20, total: 22, pct: 85 },
      truncated: false,
      entries: [
        { key: "reg:2026-08-11", kind: "REGISTER_DATE", label: "2026-08-11", at: "2026-08-11", status: "PRESENT", source: "REGISTER", marked_by_name: null },
        { key: "reg:2026-08-10", kind: "REGISTER_DATE", label: "2026-08-10", at: "2026-08-10", status: "ABSENT", source: "REGISTER", marked_by_name: null },
      ],
    },
  ],
  school_confirmations: { attended: 4, total: 6 },
  quizzes: { assigned: 0, completed: 0, items: [] },
};

beforeEach(() => { stats = base; });

describe("My Attendance", () => {
  it("leads with the canonical percentage", () => {
    const { getByText } = render(<StudentView />);
    expect(getByText("85%")).toBeTruthy();
    expect(getByText(/17 of 20 recorded/)).toBeTruthy();
  });

  it("shows a student in both kinds of cohort one card per kind", () => {
    stats = {
      ...base,
      series: [
        ...base.series,
        {
          mode: "ONLINE",
          summary: { present: 9, marked: 10, total: 10, pct: 90 },
          truncated: false,
          entries: [
            { key: "lc:1", kind: "LIVE_CLASS", label: "Algebra L3", at: "2026-08-11T10:00:00.000Z", status: "PRESENT", source: "JOIN", marked_by_name: null },
          ],
        },
      ],
    };
    const { getByText } = render(<StudentView />);
    expect(getByText("School attendance")).toBeTruthy();
    expect(getByText("Live classes")).toBeTruthy();
  });

  it("keeps the whole-school confirmation visibly about the school", () => {
    const { getByText } = render(<StudentView />);
    expect(getByText(/Your school confirmed/)).toBeTruthy();
    expect(getByText(/about your whole school, not your own attendance/i)).toBeTruthy();
  });

  it("uses no backend vocabulary anywhere on the page", () => {
    const { container } = render(<StudentView />);
    const text = container.textContent ?? "";
    for (const jargon of ["AUTO", "MANUAL", "DERIVED", "stream", "SCHOOL_BASED", "ONLINE", "register stream"]) {
      expect(text).not.toContain(jargon);
    }
  });

  it("says nothing is recorded rather than showing a bare 0%", () => {
    stats = { ...base, series: [] };
    const { getByText, queryByText } = render(<StudentView />);
    expect(getByText(/No attendance recorded yet/i)).toBeTruthy();
    expect(queryByText("0%")).toBeNull();
  });
});
