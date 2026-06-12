"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { OverviewWidgets } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type OverviewResponse = {
  totalUsers: number;
  activeCourses: number;
  totalSchools: number;
  openDoubts: number;
  dauMau: { dau: number; mau: number };
  completionPct: number;
};

const EMPTY: OverviewWidgets = {
  stats: [
    { key: "users", label: "Total Users", value: 0, helper: "No users yet" },
    { key: "courses", label: "Active Courses", value: 0, helper: "No active courses" },
    { key: "schools", label: "Schools", value: 0, helper: "No schools onboarded" },
    { key: "doubts", label: "Open Doubts (system)", value: 0, helper: "No open doubts" },
    { key: "completion", label: "Avg Completion %", value: 0, helper: "No activity yet" },
  ],
  chart: {
    title: "Active students (DAU / MAU)",
    variant: "bar",
    data: { labels: [], datasets: [] },
    emptyHelper: "Series appears after first day of activity",
  },
};

function toWidgets(r: OverviewResponse): OverviewWidgets {
  return {
    stats: [
      { key: "users", label: "Total Users", value: r.totalUsers, helper: r.totalUsers ? undefined : "No users yet" },
      { key: "courses", label: "Active Courses", value: r.activeCourses, helper: r.activeCourses ? undefined : "No active courses" },
      { key: "schools", label: "Schools", value: r.totalSchools, helper: r.totalSchools ? undefined : "No schools onboarded" },
      { key: "doubts", label: "Open Doubts (system)", value: r.openDoubts, helper: r.openDoubts ? undefined : "No open doubts" },
      { key: "completion", label: "Avg Completion %", value: Math.round(r.completionPct), helper: r.completionPct ? undefined : "No activity yet" },
    ],
    chart: {
      title: "Active students (DAU / MAU)",
      variant: "bar",
      data: {
        labels: ["DAU", "MAU"],
        datasets: [{ label: "Active students", data: [r.dauMau.dau, r.dauMau.mau] }],
      },
      // DAU/MAU is approximated from quiz-attempt activity (no events table yet).
      emptyHelper: "Series appears after first day of activity",
    },
  };
}

export function useSuperAdminOverview(userId: string) {
  const query = useQuery<OverviewWidgets, Error>({
    queryKey: qk.dashboardWidget("SUPER_ADMIN", "overview", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/analytics/dashboard/super-admin/overview`);
      if (!res.ok) return EMPTY;
      const raw = (await res.json()) as OverviewResponse;
      return toWidgets(raw);
    },
  });

  return {
    widgets: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => query.refetch(),
  };
}
