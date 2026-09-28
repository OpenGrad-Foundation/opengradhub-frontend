import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

/**
 * The Attendance tab set. "Records" is first and default because it answers the
 * question the module exists for — was this student present? The other two are
 * how data gets IN. The old "Live Classes" tab is renamed because it never held
 * live-class attendance, and the Overview tab is gone: its numbers were one
 * stream's totals, and they now live on the Records grid for the cohort shown.
 */

let perms: string[] = [];
let query = "";

vi.mock("@/hooks/use-permission", () => ({
  usePermissions: () => ({ has: (p: string) => perms.includes(p), isLoading: false }),
}));
vi.mock("@/app/dashboard/attendance/_components/RecordsTab", () => ({
  RecordsTab: () => <div>records-panel</div>,
}));
vi.mock("@/app/dashboard/attendance/_components/SchoolConfirmationsTab", () => ({
  SchoolConfirmationsTab: () => <div>confirmations-panel</div>,
}));
vi.mock("@/app/dashboard/attendance/_components/RegistersTab", () => ({
  RegistersTab: () => <div>registers-panel</div>,
}));
vi.mock("@/app/dashboard/attendance/_components/StudentView", () => ({
  StudentView: () => <div>student-panel</div>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/attendance",
  useSearchParams: () => new URLSearchParams(query),
}));

import AttendancePage from "@/app/dashboard/attendance/page";

beforeEach(() => { perms = []; query = ""; });

describe("staff Attendance", () => {
  beforeEach(() => { perms = ["attendance.view", "attendance.manage", "students.view", "live_classes.view", "schools.view"]; });

  it("offers exactly Records, School confirmations and Registers", () => {
    const { getAllByRole } = render(<AttendancePage />);
    const labels = getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["Records", "School confirmations", "Registers"]);
  });

  it("opens on Records", () => {
    const { getByText, getAllByRole } = render(<AttendancePage />);
    expect(getByText("records-panel")).toBeTruthy();
    expect(getAllByRole("tab")[0].getAttribute("aria-selected")).toBe("true");
  });

  it("has no Overview tab any more", () => {
    const { getAllByRole } = render(<AttendancePage />);
    expect(getAllByRole("tab").map((t) => t.textContent)).not.toContain("Overview");
  });

  it("no longer calls the school-links tab 'Live Classes'", () => {
    const { getAllByRole } = render(<AttendancePage />);
    expect(getAllByRole("tab").map((t) => t.textContent)).not.toContain("Live Classes");
  });
});

describe("student Attendance", () => {
  it("shows their own view with no staff tabs at all", () => {
    perms = ["attendance.view_own"];
    const { getByText, queryAllByRole } = render(<AttendancePage />);
    expect(getByText("student-panel")).toBeTruthy();
    expect(queryAllByRole("tab")).toHaveLength(0);
  });
});

describe("no attendance permission", () => {
  it("says so rather than rendering an empty shell", () => {
    const { getByText } = render(<AttendancePage />);
    expect(getByText(/don't have access/i)).toBeTruthy();
  });
});

describe("separate attendance data capabilities", () => {
  it("does not mount student records with attendance.view alone", () => {
    perms = ["attendance.view"];
    const { queryByText, getByText } = render(<AttendancePage />);
    expect(queryByText("records-panel")).toBeNull();
    expect(getByText(/View Students permission/)).toBeTruthy();
  });
  it("does not mount school confirmations without live-class viewing", () => {
    perms = ["attendance.view"]; query = "tab=confirmations";
    const { queryByText, getByText } = render(<AttendancePage />);
    expect(queryByText("confirmations-panel")).toBeNull();
    expect(getByText(/View Live Classes permission/)).toBeTruthy();
  });
  it("does not mount register identity workflows without students.view", () => {
    perms = ["attendance.view", "attendance.manage", "schools.view"]; query = "tab=registers";
    const { queryByText, getByText } = render(<AttendancePage />);
    expect(queryByText("registers-panel")).toBeNull();
    expect(getByText(/View Students permission/)).toBeTruthy();
  });
});
