import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MyAttendanceStats } from "@/lib/attendance-api";

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

let attendance: MyAttendanceStats | undefined;
vi.mock("@/lib/queries/attendance", () => ({
  useMyAttendance: () => ({ data: attendance, isLoading: false, isError: false }),
}));

vi.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
}));

import StudentOverview from "@/components/dashboard/roles/student/Overview";

const stats = (series: MyAttendanceStats["series"]): MyAttendanceStats => ({
  from: "2026-06-01",
  to: "2026-08-24",
  series,
  school_confirmations: { attended: 0, total: 0 },
  quizzes: { assigned: 0, completed: 0, items: [] },
});

function wrap(node: React.ReactNode) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

describe("StudentOverview", () => {
  it("renders the stats and chart from the hook", () => {
    attendance = stats([
      { mode: "SCHOOL_BASED", summary: { present: 17, marked: 20, total: 22, pct: 85 }, entries: [], truncated: false },
    ]);
    render(wrap(<StudentOverview userId="s-1" />));
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("76")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Recent quiz scores")).toBeTruthy();
  });

  it("shows ONE attendance figure, from the canonical API", () => {
    // Two side-by-side percentages read as one number contradicting itself,
    // which is what the consolidation removed. The dashboard asks the same
    // canonical question every other surface does.
    attendance = stats([
      { mode: "SCHOOL_BASED", summary: { present: 17, marked: 20, total: 22, pct: 85 }, entries: [], truncated: false },
    ]);
    render(wrap(<StudentOverview userId="s-1" />));
    expect(screen.getByText("Attendance")).toBeTruthy();
    expect(screen.getByText("85")).toBeTruthy();
    expect(screen.queryByText("Register %")).toBeNull();
    expect(screen.queryByText("Live class %")).toBeNull();
  });

  it("combines a mixed-mode student's cohorts into one figure", () => {
    attendance = stats([
      { mode: "ONLINE", summary: { present: 9, marked: 10, total: 10, pct: 90 }, entries: [], truncated: false },
      { mode: "SCHOOL_BASED", summary: { present: 1, marked: 10, total: 10, pct: 10 }, entries: [], truncated: false },
    ]);
    render(wrap(<StudentOverview userId="s-1" />));
    // 10 present of 20 recorded — not the mean of 90 and 10, which would weight
    // a two-day cohort the same as a two-month one.
    expect(screen.getByText("50")).toBeTruthy();
  });

  it("says nothing is recorded rather than showing a bare zero", () => {
    attendance = stats([]);
    render(wrap(<StudentOverview userId="s-1" />));
    expect(screen.getByText(/No attendance recorded yet/i)).toBeTruthy();
  });
});
