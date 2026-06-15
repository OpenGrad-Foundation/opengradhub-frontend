import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/queries/dashboard/student/use-overview", () => ({
  useStudentOverview: () => ({
    isLoading: false,
    error: null,
    widgets: {
      myCourses: 3,
      avgScore: 76,
      openDoubts: 2,
      attendancePct: 91,
      recentScores: { labels: ["Q1", "Q2"], datasets: [{ label: "Score", data: [70, 82] }] },
    },
    refetch: () => {},
  }),
}));

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
}));

import StudentOverview from "@/components/dashboard/roles/student/Overview";

function wrap(node: React.ReactNode) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe("StudentOverview", () => {
  it("renders all 4 stats + chart with values from the hook", () => {
    render(wrap(<StudentOverview userId="s-1" />));
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("76")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("91")).toBeTruthy();
    expect(screen.getByText("Recent quiz scores")).toBeTruthy();
  });
});
