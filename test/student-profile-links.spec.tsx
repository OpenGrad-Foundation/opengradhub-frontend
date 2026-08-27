import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/useCurrentUrl", () => ({ useCurrentUrl: () => "/dashboard/analytics" }));

// next/link renders a plain anchor under jsdom.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));

const managerData = {
  view: "students" as const,
  students: [
    { id: "stu-1", name: "Asha", completion_pct: 20, best_score: 40, avg_score: 33, assignment_status: "ACTIVE" },
  ],
  quiz_distribution: [],
};
vi.mock("@/lib/queries/analytics", () => ({
  useManagerAnalytics: () => ({ data: managerData, isPending: false, error: null }),
}));
vi.mock("react-chartjs-2", () => ({ Bar: () => <div data-testid="bar" /> }));

import { NeedsAttention } from "@/app/dashboard/analytics/_components/NeedsAttention";
import ManagerDrill from "@/app/dashboard/analytics/_components/ManagerDrill";

const needsAttentionData = {
  at_risk_students: [
    { id: "stu-1", name: "Asha", school_name: "GHSS", completion_pct: 20, avg_score: 33, last_activity_at: null },
  ],
  worst_quizzes: [],
} as any;

describe("at-risk student links", () => {
  it("points an at-risk row at that student's profile page", () => {
    const { getByText } = render(<NeedsAttention data={needsAttentionData} />);
    const link = getByText("Asha").closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/dashboard/students/stu-1");
  });

  it("carries the current page as the back target", () => {
    const { getByText } = render(<NeedsAttention data={needsAttentionData} />);
    const link = getByText("Asha").closest("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain(`from=${encodeURIComponent("/dashboard/analytics")}`);
  });

  it("links student names in the course drill-down to their profile", () => {
    const { getByText } = render(
      <ManagerDrill courseId="c1" courseTitle="Algebra" onBack={() => {}} />,
    );
    const link = getByText("Asha").closest("a") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toContain("/dashboard/students/stu-1");
  });
});
