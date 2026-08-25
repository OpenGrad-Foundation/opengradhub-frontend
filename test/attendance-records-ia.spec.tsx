import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RecordsView } from "@/lib/attendance-api";
import { recordsToCsv, csvFilename } from "@/lib/attendance-csv";

/**
 * The structural finding from the review: a 25 x 90 matrix is a desktop
 * comparison tool, and it was the first thing a fellow on a phone landed on.
 * The list leads now, the grid is opt-in, and both are addressable by URL so a
 * report can actually be sent to the person who has to act on it.
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

let records: RecordsView | undefined;
vi.mock("@/lib/queries/attendance", () => ({
  useAttendanceRecords: () => ({ data: records, isPending: false, error: null }),
  useStudentRecords: () => ({ data: undefined, isPending: true, error: null }),
  useClassRoster: () => ({ data: undefined, isPending: true, error: null }),
  useMarkClassAttendance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/queries/batches", () => ({
  useBatches: () => ({ data: [{ id: "b1", name: "Batch One" }], isError: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getCourses: () => Promise.resolve([]),
}));

import { RecordsTab } from "@/app/dashboard/attendance/_components/RecordsTab";

const DATA: RecordsView = {
  mode: "SCHOOL_BASED",
  from: "2026-08-01",
  to: "2026-08-31",
  occasions: [
    { key: "d1", kind: "REGISTER_DATE", at: "2026-08-11", label: "2026-08-11" },
    { key: "d2", kind: "REGISTER_DATE", at: "2026-08-12", label: "2026-08-12" },
  ],
  students: [
    { id: "s1", name: "Asha", school_name: "Govt HSS", cells: ["PRESENT", "PRESENT"], present: 2, marked: 2, total: 2, pct: 100 },
    { id: "s2", name: "Bala", school_name: "Govt HSS", cells: ["UNKNOWN", "UNKNOWN"], present: 0, marked: 0, total: 2, pct: 0 },
    { id: "s3", name: "Chitra", school_name: null, cells: ["PRESENT", "ABSENT"], present: 1, marked: 2, total: 2, pct: 50 },
  ],
  totals: { students: 3, occasions: 2, present: 3, marked: 4, pct: 75 },
  page: 1, limit: 25, total: 3,
} as unknown as RecordsView;

function open() {
  const r = render(<RecordsTab />);
  fireEvent.change(screen.getByLabelText("Select batch"), { target: { value: "b1" } });
  r.rerender(<RecordsTab />);
  return r;
}

beforeEach(() => {
  url.search = "";
  records = DATA;
});

describe("the list leads, the matrix is opt-in", () => {
  it("opens on a per-student list, not a wide grid", () => {
    open();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: /Asha/ })).toBeTruthy();
  });

  it("puts the students with the biggest hole in the record first", () => {
    open();
    const names = screen.getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => /Asha|Bala|Chitra/.test(t));
    // Bala has nothing recorded at all — that is the row someone has to act on,
    // and alphabetical order would bury it in the middle.
    expect(names[0]).toContain("Bala");
  });

  it("says 'Nothing recorded' rather than 0% for a student with no marks", () => {
    open();
    const bala = screen.getByRole("button", { name: /Bala/ });
    expect(bala.textContent).toContain("Nothing recorded");
    expect(bala.textContent).not.toContain("0%");
  });

  it("switches to the matrix on request", () => {
    const r = open();
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    r.rerender(<RecordsTab />);
    expect(screen.getByRole("table")).toBeTruthy();
  });
});

describe("a filtered report is shareable", () => {
  it("puts the cohort in the URL", () => {
    open();
    expect(url.search).toContain("id=b1");
  });

  it("puts the date range in the URL", () => {
    const r = open();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-08-01" } });
    r.rerender(<RecordsTab />);
    expect(url.search).toContain("from=2026-08-01");
  });

  it("keeps the chosen layout in the URL", () => {
    const r = open();
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    r.rerender(<RecordsTab />);
    expect(url.search).toContain("view=grid");
  });

  it("restores everything from the URL on a cold load", () => {
    url.search = "id=b1&view=grid&from=2026-08-01";
    render(<RecordsTab />);
    // No clicks — this is what a pasted link has to produce.
    expect(screen.getByRole("table")).toBeTruthy();
    expect((screen.getByLabelText("From date") as HTMLInputElement).value).toBe("2026-08-01");
  });

  it("leaves a default view's URL clean", () => {
    render(<RecordsTab />);
    expect(url.search).toBe("");
  });

  it("makes an open student history addressable, and Back closes it", () => {
    const r = open();
    fireEvent.click(screen.getByRole("button", { name: /Asha/ }));
    expect(url.search).toContain("student=s1");
    r.rerender(<RecordsTab />);
    // Opening pushed, so the browser's own Back gesture is the way out.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("the report leaves the app as a spreadsheet", () => {
  it("writes statuses as words, never as the grid's glyphs", () => {
    const csv = recordsToCsv(DATA);
    expect(csv).toContain("Not recorded");
    // Outside the legend a bare dash reads as absent, and this file is opened
    // by people who never saw the screen.
    expect(csv).not.toContain("–");
    expect(csv).not.toContain("✓");
  });

  it("keeps a percentage of nothing blank rather than zero", () => {
    const line = recordsToCsv(DATA).split("\r\n").find((l) => l.startsWith("Bala"))!;
    expect(line.endsWith(",")).toBe(true);
    expect(line).not.toContain("0%");
  });

  it("quotes anything containing a comma or a quote", () => {
    const tricky = {
      ...DATA,
      students: [{ ...DATA.students[0], name: 'Rao, A "Bunny"' }],
    } as unknown as RecordsView;
    expect(recordsToCsv(tricky)).toContain('"Rao, A ""Bunny"""');
  });

  it("names the file after the cohort mode and the period", () => {
    expect(csvFilename(DATA, "2026-08-01", "2026-08-31"))
      .toBe("attendance-school_based-2026-08-01-to-2026-08-31.csv");
  });

  it("offers the export from the report itself", () => {
    open();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeTruthy();
  });
});
