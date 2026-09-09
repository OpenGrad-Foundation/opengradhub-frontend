import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import StudentsPage from "@/app/dashboard/students/page";
import type { StudentDirectoryFilters } from "@/lib/api";

let grants = ["students.view", "analytics.view"];
vi.mock("@/hooks/use-permission", () => ({
  usePermissions: () => ({ has: (code: string) => grants.includes(code) }),
  useAnyPermission: (...codes: string[]) => codes.some(code => grants.includes(code)),
}));
let mockRows: unknown[] = [];
let mockTotal = 0;
let search = "";
const listCalls: StudentDirectoryFilters[] = [];
const replace = vi.fn();
vi.mock("@/lib/queries/students", () => ({
  useStudentsList: (filters: StudentDirectoryFilters) => {
    listCalls.push(filters);
    return { data: { rows: mockRows, total: mockTotal }, isPending: false, error: null };
  },
  useStudentFacets: () => ({ data: { programmes: [], schools: [], batches: [], inCharges: [] } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/students",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

beforeEach(() => {
  grants = ["students.view", "analytics.view"];
  mockRows = [];
  mockTotal = 0;
  search = "";
  listCalls.length = 0;
  replace.mockReset();
});

describe("Students directory", () => {
  it("shows roster identity without a profile link or contact details for roster-only viewers", () => {
    grants = ["students.view"];
    mockRows = [{ user_id: "s1", name: "Asha R", email: "asha@example.test" }];
    mockTotal = 1;
    render(<StudentsPage />);
    expect(screen.getByText("Asha R").closest("a")).toBeNull();
    expect(screen.queryByText("asha@example.test")).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Email" })).toBeNull();
  });

  it("displays student contact fields only with the separate contact grant", () => {
    grants = ["students.view", "students.view_contact"];
    mockRows = [{ user_id: "s1", name: "Asha R", email: "asha@example.test" }];
    mockTotal = 1;
    render(<StudentsPage />);
    expect(screen.getByText("asha@example.test")).toBeTruthy();
    expect(screen.getByText("Asha R").closest("a")).toBeNull();
  });

  it("renders an empty state when nobody is in scope", () => {
    render(<StudentsPage />);
    expect(screen.getByText(/No students/i)).toBeTruthy();
  });

  it("renders a row linking to that student's profile", () => {
    search = "state=Tamil+Nadu&page=2";
    mockRows = [{
      user_id: "s1", name: "Asha R", roll_number: "R1",
      school_id: "sc1", school_name: "GHSS", in_charge_id: "f1", in_charge_name: "Meera",
      state: "Tamil Nadu", district: "Salem", programme_id: "p1", programme_name: "CAT",
    }];
    mockTotal = 51;
    render(<StudentsPage />);
    expect(screen.getByText("Asha R")).toBeTruthy();
    expect(screen.getByText("Meera")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Asha R/ });
    expect(link.getAttribute("href")).toContain("/dashboard/students/s1");
    expect(link.getAttribute("href")).toContain("from=%2Fdashboard%2Fstudents%3Fstate%3DTamil%2BNadu%26page%3D2");
  });

  it("labels the district column as Zone", () => {
    render(<StudentsPage />);
    expect(screen.getByText("Zone")).toBeTruthy();
  });

  it("renders a sane range when the current page is empty", () => {
    search = "page=2";
    mockTotal = 40;
    render(<StudentsPage />);
    expect(listCalls.at(-1)?.offset).toBe(50);
    expect(screen.getByText("Showing 0-0 of 40")).toBeTruthy();
  });

  it("refetches with a changed filter and resets the offset", () => {
    search = "page=2";
    render(<StudentsPage />);
    expect(listCalls.at(-1)?.offset).toBe(50);

    fireEvent.change(screen.getByRole("textbox", { name: "Filter by state" }), {
      target: { value: "Tamil Nadu" },
    });

    expect(listCalls.at(-1)).toMatchObject({ state: "Tamil Nadu", offset: 0 });
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/students?state=Tamil+Nadu",
      { scroll: false },
    );
  });

  it("keeps the in-flight search term when another filter changes first", () => {
    // The 300ms window is the whole bug. Typing schedules the debounce; changing
    // a select before it fires took the OTHER branch, which used to write
    // `q: debouncedQ || undefined` -- still "" at that point -- and dropped the
    // search term out of the URL. A row clicked inside that window then handed
    // the profile page a `from=` link with no search in it.
    vi.useFakeTimers();
    const { unmount } = render(<StudentsPage />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search students" }), {
      target: { value: "Asha" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Filter by state" }), {
      target: { value: "Tamil Nadu" },
    });

    expect(replace).toHaveBeenCalledWith(
      "/dashboard/students?q=Asha&state=Tamil+Nadu",
      { scroll: false },
    );
    unmount();
    vi.useRealTimers();
  });

  it("debounces both search refetches and URL writes", () => {
    vi.useFakeTimers();
    const { unmount } = render(<StudentsPage />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search students" }), {
      target: { value: "Asha" },
    });
    expect(listCalls.at(-1)?.q).toBeUndefined();
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));

    expect(listCalls.at(-1)).toMatchObject({ q: "Asha", offset: 0 });
    expect(replace).toHaveBeenCalledWith(
      "/dashboard/students?q=Asha",
      { scroll: false },
    );
    unmount();
    vi.useRealTimers();
  });
});
