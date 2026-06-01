"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

export type StudentOverviewWidgets = {
  myCourses: number;
  avgScore: number;
  openDoubts: number;
  attendancePct: number;
  recentScores: {
    labels: string[];
    datasets: Array<{ label: string; data: number[] }>;
  };
};

const EMPTY: StudentOverviewWidgets = {
  myCourses: 0,
  avgScore: 0,
  openDoubts: 0,
  attendancePct: 0,
  recentScores: { labels: [], datasets: [] },
};

export function useStudentOverview(userId: string) {
  const qc = useQueryClient();
  const query = useQuery<StudentOverviewWidgets, Error>({
    queryKey: qk.dashboardWidget("STUDENT", "overview", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [enrolmentsRes, doubtsRes] = await Promise.all([
        apiFetch(`${API_BASE}/users/${userId}/enrolments`),
        apiFetch(`${API_BASE}/doubts?mine=1&status=open`),
      ]);

      const enrolments: unknown = enrolmentsRes.ok ? await enrolmentsRes.json() : [];
      const doubts: unknown = doubtsRes.ok ? await doubtsRes.json() : [];

      const myCourses = Array.isArray(enrolments)
        ? enrolments.length
        : Array.isArray((enrolments as { items?: unknown[] })?.items)
          ? (enrolments as { items: unknown[] }).items.length
          : 0;

      const openDoubts = Array.isArray(doubts)
        ? doubts.length
        : Array.isArray((doubts as { items?: unknown[] })?.items)
          ? (doubts as { items: unknown[] }).items.length
          : 0;

      // TODO(dashboard-backend): wire avgScore, attendancePct, recentScores from
      // /analytics/dashboard/student/overview once that endpoint exists.
      return {
        myCourses,
        avgScore: 0,
        openDoubts,
        attendancePct: 0,
        recentScores: { labels: [], datasets: [] },
      };
    },
  });

  return {
    widgets: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () =>
      qc.invalidateQueries({ queryKey: qk.dashboard("STUDENT", "overview") }),
  };
}
