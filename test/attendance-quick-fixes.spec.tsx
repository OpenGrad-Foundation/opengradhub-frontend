import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
/** Every filter object the records query was asked for, in order. */
const recordsCalls: Record<string, unknown>[] = [];

/**
 * Records keeps its filters in the URL now, so the tests need a query string
 * that actually changes when a control is used — a stub router would leave the
 * component permanently on its defaults.
 */
const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: (u: string) => { url.search = u.includes("?") ? u.slice(u.indexOf("?") + 1) : ""; },
    push: (u: string) => { url.search = u.includes("?") ? u.slice(u.indexOf("?") + 1) : ""; },
    back: () => { url.search = ""; },
  }),
  useSearchParams: () => new URLSearchParams(url.search),
  usePathname: () => "/dashboard/attendance",
}));

vi.mock("@/lib/queries/attendance", () => ({
  useClassRoster: () => ({ data: roster, ...rosterState }),
  useMarkClassAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAttendanceRecords: (f: Record<string, unknown>) => {
    recordsCalls.push(f);
    return { data: records, isPending: false, error: null };
  },
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
  recordsCalls.length = 0;
  url.search = "";
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
    const r = render(<RecordsTab />);
    fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
    r.rerender(<RecordsTab />);
    return r;
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

    const r = render(<RecordsTab />);
    fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
    r.rerender(<RecordsTab />);
    fireEvent.click(screen.getByRole("button", { name: /Asha/ }));
    r.rerender(<RecordsTab />);

    // The summary counts 40 marks; the list shows 1. Without this line the two
    // read as a contradiction.
    expect(screen.getByText(/Older records are in the total above but not listed/i)).toBeTruthy();
  });
});

describe("a mis-tap is always recoverable", () => {
  /** Reads the status chip currently rendered for a row. */
  const chipFor = (name: string) =>
    screen.getByText(name).closest("[data-roster-row]")!.textContent!;

  it("cycles an unrecorded row back to Not recorded rather than trapping it", () => {
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    const row = () => screen.getByText("Asha");

    expect(chipFor("Asha")).toContain("Not recorded");
    fireEvent.click(row());
    expect(chipFor("Asha")).toContain("Present");
    fireEvent.click(row());
    expect(chipFor("Asha")).toContain("Absent");
    fireEvent.click(row());
    // Back where it started — the old toggle could never return here.
    expect(chipFor("Asha")).toContain("Not recorded");
  });

  it("restores a recorded row on the second tap", () => {
    roster = {
      ...ONLINE_ROSTER,
      rows: [{ ...ONLINE_ROSTER.rows[0], status: "PRESENT", source: "JOIN", joined_at: "2026-08-11T04:31:00.000Z" }],
    };
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);

    fireEvent.click(screen.getByText("Asha"));
    expect(chipFor("Asha")).toContain("Absent");
    fireEvent.click(screen.getByText("Asha"));
    expect(chipFor("Asha")).toContain("Present");
  });

  it("shows what the row was, so a change can be reviewed before saving", () => {
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    fireEvent.click(screen.getByText("Asha"));
    expect(chipFor("Asha")).toContain("was not recorded");
  });

  it("keeps a row you just changed on screen under a status filter", () => {
    render(<ClassRoster liveClassId="c1" onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Not recorded" }));
    expect(screen.getByText("Asha")).toBeTruthy();

    fireEvent.click(screen.getByText("Asha")); // now PRESENT — no longer matches
    // It must not vanish: that hid the mistake before the user could see it,
    // and took the only undo with it.
    expect(screen.getByText("Asha")).toBeTruthy();
  });
});

describe("the grid explains its own marks", () => {
  const GRID = {
    mode: "ONLINE",
    totals: { present: 1, marked: 2, students: 1, occasions: 2, pct: 50 },
    occasions: [
      { key: "lc:1", kind: "LIVE_CLASS", at: "2026-08-11T04:30:00.000Z", label: "Maths" },
      { key: "lc:2", kind: "LIVE_CLASS", at: "2026-08-11T09:30:00.000Z", label: "Science" },
    ],
    students: [{ id: "s1", name: "Asha", school_name: null, cells: ["PRESENT", "UNKNOWN"], marked: 1, present: 1, pct: 100 }],
    page: 1, limit: 25, total: 1,
  } as unknown as RecordsView;

  /** The matrix is opt-in now, so switch to it before asserting on it. */
  function renderGrid() {
    records = GRID;
    const r = render(<RecordsTab />);
    fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
    r.rerender(<RecordsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    r.rerender(<RecordsTab />);
  }

  it("shows a legend, because a bare '–' reads as absent", () => {
    renderGrid();
    const legend = screen.getByText(/% is of what was recorded/i).parentElement!;
    expect(legend.textContent).toContain("Present");
    expect(legend.textContent).toContain("Absent");
    expect(legend.textContent).toContain("Not recorded");
  });

  it("gives every cell a label a screen reader can read", () => {
    renderGrid();
    // The glyph is aria-hidden; the meaning travels in text.
    expect(screen.getByText("Present on Maths")).toBeTruthy();
    expect(screen.getByText("Not recorded on Science")).toBeTruthy();
  });

  it("distinguishes two classes held on the same date", () => {
    renderGrid();
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    const dated = heads.filter((h) => h?.includes("Aug"));
    expect(dated).toHaveLength(2);
    expect(dated[0]).not.toEqual(dated[1]);
  });

  it("shows the denominator next to the percentage", () => {
    renderGrid();
    // "100%" alone invites "percent of every class"; it is percent of recorded.
    expect(screen.getByText("of 1")).toBeTruthy();
  });
});

describe("the student search waits for a pause", () => {
  it("does not re-query on every keystroke", () => {
    records = {
      mode: "ONLINE",
      totals: { present: 0, marked: 0, students: 0, occasions: 0, pct: 0 },
      occasions: [], students: [], page: 1, limit: 25, total: 0,
    } as unknown as RecordsView;

    // Pick the cohort on REAL timers: under fake timers React never commits the
    // rerender, so the component would still be sitting on its defaults.
    const r = render(<RecordsTab />);
    fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
    r.rerender(<RecordsTab />);

    vi.useFakeTimers();
    try {
      const box = screen.getByLabelText("Find a student");
      recordsCalls.length = 0;
      for (const v of ["A", "As", "Ash", "Asha"]) fireEvent.change(box, { target: { value: v } });

      // Every keystroke re-renders, but none of them may reach the query.
      expect(recordsCalls.filter((f) => f.student_q !== undefined)).toHaveLength(0);

      act(() => { vi.advanceTimersByTime(350); });
    } finally {
      vi.useRealTimers();
    }

    // The debounce's contract is the URL it writes — that is both what the
    // query reads back and what makes the filtered view shareable. Asserting on
    // it directly avoids depending on when React chooses to commit.
    expect(url.search).toContain("q=Asha");
    expect(url.search).toContain("id=b1");
  });
});
