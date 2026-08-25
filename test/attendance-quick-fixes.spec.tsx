import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import type { ClassRosterView, RecordsView } from "@/lib/attendance-api";

/**
 * Six fixes from the UI review, all of the same family: a screen must not state
 * something it has no evidence for, and must not quietly destroy the user's work.
 */

let roster: ClassRosterView;
let rosterState: { isPending: boolean; error: Error | null };
let records: RecordsView | undefined;
let studentRecords: { data: unknown; isPending: boolean; error: Error | null };

vi.mock("@/lib/queries/attendance", () => ({
  useClassRoster: () => ({ data: roster, ...rosterState }),
  useMarkClassAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAttendanceRecords: () => ({ data: records, isPending: false, error: null }),
  useStudentRecords: () => studentRecords,
}));
let batchesState: { data: unknown[]; isError: boolean; refetch: () => void };
vi.mock("@/lib/queries/batches", () => ({ useBatches: () => batchesState }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getCourses: () => Promise.resolve([]),
}));

import { ClassRoster } from "@/app/dashboard/live-classes/_components/ClassRoster";
import { RecordsTab } from "@/app/dashboard/attendance/_components/RecordsTab";
import { ClassFilterBar } from "@/app/dashboard/live-classes/_components/ClassFilterBar";

const ONLINE_ROSTER: ClassRosterView = {
  class: { id: "c1", title: "Maths", scheduled_at: "2026-08-11T04:30:00.000Z", attendance_mode: "ONLINE" },
  can_mark: true,
  source: "JOIN",
  note: null,
  rows: [
    { student_id: "s1", name: "Asha", email: null, school_name: null, status: "UNKNOWN", source: "NONE", joined_at: null, marked_at: null, marked_by_name: null },
  ],
};

beforeEach(() => {
  roster = ONLINE_ROSTER;
  rosterState = { isPending: false, error: null };
  records = undefined;
  batchesState = { data: [{ id: "b1", name: "Batch One" }], isError: false, refetch: vi.fn() };
  studentRecords = { data: undefined, isPending: true, error: null };
  vi.restoreAllMocks();
});

describe("a roster still loading has not concluded anything", () => {
  it("says Loading rather than 'Nothing recorded yet · 0 students'", () => {
    roster = undefined as unknown as ClassRosterView;
    rosterState = { isPending: true, error: null };
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    expect(screen.queryByText(/Nothing recorded yet/i)).toBeNull();
  });

  it("says so when the roster failed, instead of reporting an empty one", () => {
    roster = undefined as unknown as ClassRosterView;
    rosterState = { isPending: false, error: new Error("boom") };
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    expect(screen.getByText(/Couldn't load this roster/i)).toBeTruthy();
    expect(screen.queryByText(/Nothing recorded yet/i)).toBeNull();
  });
});

describe("staged marks are not thrown away by a stray click", () => {
  it("asks before discarding, and keeps the dialog open when refused", () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ClassRoster liveClassId="c1" onClose={onClose} />);

    fireEvent.click(screen.getByText("Asha"));           // stage one mark
    fireEvent.keyDown(document, { key: "Escape" });      // then try to leave

    expect(confirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without asking when nothing is staged", () => {
    const onClose = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ClassRoster liveClassId="c1" onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("a cohort with no marks is not a cohort at 0%", () => {
  /** Records renders nothing until a cohort is chosen, so choose one. */
  function renderWithBatch() {
    render(<RecordsTab />);
    fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
  }

  it("the totals strip refuses to print 0% / 0 of 0", () => {
    records = {
      mode: "SCHOOL_BASED",
      totals: { present: 0, marked: 0, students: 12, occasions: 4, pct: 0 },
      occasions: [], students: [], page: 1, limit: 25, total: 12,
    } as unknown as RecordsView;
    renderWithBatch();

    expect(screen.getByText(/Nothing recorded yet/i)).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByText(/0 of 0/)).toBeNull();
    // The cohort size is still worth stating — it just isn't a verdict.
    expect(screen.getByText(/12 students/)).toBeTruthy();
  });

  it("still prints the percentage once something is recorded", () => {
    records = {
      mode: "SCHOOL_BASED",
      totals: { present: 3, marked: 4, students: 12, occasions: 4, pct: 75 },
      occasions: [], students: [], page: 1, limit: 25, total: 12,
    } as unknown as RecordsView;
    renderWithBatch();

    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.queryByText(/Nothing recorded yet/i)).toBeNull();
  });
});

describe("the audience picker admits when it could not load", () => {
  it("offers a retry instead of showing an empty list", () => {
    batchesState = { data: [], isError: true, refetch: vi.fn() };
    render(<ClassFilterBar state={{ view: "upcoming", q: "", audience: "", archived: false }} set={vi.fn()} />);

    expect(screen.getByText(/Couldn't load audiences/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByLabelText("Audience")).toBeNull();
  });
});

describe("a new live class targets nobody until asked to", () => {
  it("does not pre-select a programme", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/live-classes/new/page.tsx"),
      "utf-8",
    );
    // A default here silently ANDs a programme into every class the user
    // schedules, dropping students in the batch they actually chose.
    expect(src).toContain('const [progType, setProgType] = useState("")');
    expect(src).not.toContain('useState("UG")');
  });
});

describe("a shortened history says it is shortened", () => {
  it("warns that the list is a tail of a longer period", () => {
    records = {
      mode: "SCHOOL_BASED",
      totals: { present: 3, marked: 4, students: 1, occasions: 4, pct: 75 },
      occasions: [{ key: "reg:2026-08-11", kind: "REGISTER_DATE", at: "2026-08-11", label: "2026-08-11" }],
      students: [{ id: "s1", name: "Asha", school_name: null, cells: ["PRESENT"], marked: 1, present: 1, pct: 100 }],
      page: 1, limit: 25, total: 1,
    } as unknown as RecordsView;
    studentRecords = {
      isPending: false, error: null,
      data: {
        student: { id: "s1", name: "Asha", school_name: null },
        note: null,
        series: [{
          mode: "SCHOOL_BASED",
          summary: { present: 30, marked: 40, total: 60, pct: 75 },
          truncated: true,
          entries: [{ key: "reg:2026-08-11", kind: "REGISTER_DATE", label: "2026-08-11", at: "2026-08-11", status: "PRESENT", source: "REGISTER", marked_by_name: null }],
        }],
      },
    };

    render(<RecordsTab />);
    fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
    fireEvent.click(screen.getByRole("button", { name: /Asha/ }));

    // The summary counts 40 marks; the list shows 1. Without this line the two
    // read as a contradiction.
    expect(screen.getByText(/Older records are in the total above but not listed/i)).toBeTruthy();
  });
});
