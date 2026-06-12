"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { OverviewWidgets } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "GOVERNMENT" | "FUNDING_PARTNER";

type InsightsResponse = {
  kpis: {
    students_reached: { value: number };
    districts_covered: { value: number };
    ug_pg_split: { ug: number; pg: number };
    avg_score: { value: number };
  };
  trend: Array<{ month: string; new_enrolments: number; avg_score: number | null }>;
};

const EMPTY: OverviewWidgets = {
  stats: [
    { key: "students", label: "Students Reached", value: 0, helper: "No students yet" },
    { key: "avg", label: "Avg Score %", value: 0, helper: "No scores yet" },
    { key: "districts", label: "Districts Covered", value: 0, helper: "No districts yet" },
    { key: "ug", label: "UG Students", value: 0, helper: "No UG students" },
  ],
  chart: {
    title: "New enrolments (12 mo)",
    variant: "line",
    data: { labels: [], datasets: [] },
    emptyHelper: "Series appears after first enrolments",
  },
};

function toWidgets(r: InsightsResponse): OverviewWidgets {
  const k = r.kpis;
  const trend = r.trend ?? [];
  return {
    stats: [
      { key: "students", label: "Students Reached", value: k.students_reached.value, helper: "No students yet" },
      { key: "avg", label: "Avg Score %", value: Math.round(k.avg_score.value), helper: "No scores yet" },
      { key: "districts", label: "Districts Covered", value: k.districts_covered.value, helper: "No districts yet" },
      { key: "ug", label: "UG Students", value: k.ug_pg_split.ug, helper: "No UG students" },
    ],
    chart: {
      title: "New enrolments (12 mo)",
      variant: "line",
      data: {
        labels: trend.map((t) => t.month),
        datasets: trend.length
          ? [{ label: "New enrolments", data: trend.map((t) => t.new_enrolments) }]
          : [],
      },
      emptyHelper: "Series appears after first enrolments",
    },
  };
}

/**
 * Role-overview backed by /analytics/insights, which auto-resolves scope
 * server-side from the caller's role (no params needed). Shared by the
 * GOVERNMENT / FELLOW / PROGRAM_MANAGER / ZONAL_MANAGER / FUNDING_PARTNER
 * overview tabs.
 */
export function useInsightsOverview(role: Role, userId: string) {
  const query = useQuery<OverviewWidgets, Error>({
    queryKey: qk.dashboardWidget(role, "overview", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/analytics/insights`);
      if (!res.ok) return EMPTY;
      const raw = (await res.json()) as InsightsResponse;
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
