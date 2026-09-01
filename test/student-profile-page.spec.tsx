import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "stu-1" }),
  useSearchParams: () => searchParams,
  usePathname: () => "/dashboard/students/stu-1",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const profileState: { data: any; isPending: boolean; error: unknown } = {
  data: null, isPending: false, error: null,
};
vi.mock("@/lib/queries/students", () => ({
  useStudentProfile: () => profileState,
}));
vi.mock("@/lib/queries/analytics", () => ({
  useTopicStrength: () => ({ data: [], isPending: false, error: null }),
}));
vi.mock("@/lib/queries/reports", () => ({
  useReportHistory: () => ({ data: { rows: [] }, isPending: false, isError: false, error: null }),
}));
// The tracker section is exercised on its own in student-tracker-section.spec.tsx;
// here it only needs to not require a QueryClient.
vi.mock("@/lib/queries/tracker", () => ({
  useStudentDetails: () => ({ data: null, error: null }),
  useStudentTrackerTasks: () => ({ data: null, error: null }),
  useRecordPeriodHistory: () => ({ data: null, isLoading: false }),
}));
vi.mock("@/components/performance-history-table", () => ({
  PerformanceHistoryTable: () => <div data-testid="history-table" />,
}));

import StudentProfilePage from "@/app/dashboard/students/[id]/page";

function profile(over: Record<string, any> = {}) {
  return {
    student: {
      id: "stu-1", name: "Asha Menon", email: "asha@x.com", phone: null,
      roll_number: "R-1", programme: "UG", status: "ACTIVE",
      school_id: "s1", school_name: "GHSS Kozhikode", district: "KOZHIKODE",
      state: "KERALA", batches: [{ id: "b1", name: "NEET Batch A" }],
    },
    kpis: {
      completion_pct: 32, avg_score: 41.5, attempts: 7,
      last_activity_at: "2026-08-01T00:00:00.000Z", at_risk: true,
    },
    courses: [
      { id: "c1", title: "Algebra", lessons_total: 10, lessons_done: 3, completion_pct: 30, avg_score: 44 },
    ],
    ...over,
  };
}

beforeEach(() => {
  profileState.data = profile();
  profileState.isPending = false;
  profileState.error = null;
});
afterEach(cleanup);

describe("StudentProfilePage", () => {
  it("shows the student identity and school", () => {
    const { getByText } = render(<StudentProfilePage />);
    expect(getByText("Asha Menon")).toBeTruthy();
    expect(getByText(/GHSS Kozhikode/)).toBeTruthy();
  });

  it("shows the completion and score KPIs", () => {
    const { getByText } = render(<StudentProfilePage />);
    expect(getByText("32%")).toBeTruthy();
    expect(getByText("41.5%")).toBeTruthy();
  });

  it("flags an at-risk student", () => {
    const { getByText } = render(<StudentProfilePage />);
    expect(getByText(/At risk/i)).toBeTruthy();
  });

  it("omits the at-risk flag for a healthy student", () => {
    profileState.data = profile({
      kpis: { completion_pct: 80, avg_score: 74, attempts: 7, last_activity_at: null, at_risk: false },
    });
    const { queryByText } = render(<StudentProfilePage />);
    expect(queryByText(/At risk/i)).toBeNull();
  });

  it("lists the enrolled courses with their progress", () => {
    const { getByText } = render(<StudentProfilePage />);
    expect(getByText("Algebra")).toBeTruthy();
    expect(getByText("3 / 10")).toBeTruthy();
  });

  it("links back to the page the user came from", () => {
    searchParams.set("from", "/dashboard/analytics");
    const { getByRole } = render(<StudentProfilePage />);
    expect(getByRole("link", { name: /back/i }).getAttribute("href")).toBe("/dashboard/analytics");
    searchParams.delete("from");
  });

  it("surfaces an out-of-scope error instead of an empty page", () => {
    profileState.data = null;
    profileState.error = Object.assign(new Error("Student is outside your scope"), { status: 403 });
    const { getByText } = render(<StudentProfilePage />);
    expect(getByText(/outside your scope/i)).toBeTruthy();
  });
});
