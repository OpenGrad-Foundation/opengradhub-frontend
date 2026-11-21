"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";
import { retryAfterAt } from "@/lib/queries/retry";

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

async function loadWidgetData<T>(path: string): Promise<T> {
  const response = await apiFetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new ApiError("Failed to load the student overview.", response);
  return response.json() as Promise<T>;
}

export function useStudentOverview(userId: string) {
  const query = useQuery<StudentOverviewWidgets, Error>({
    queryKey: qk.dashboardWidget("STUDENT", "overview", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [enrolmentsResult, doubtsResult, overviewResult] = await Promise.allSettled([
        loadWidgetData<unknown>(`/users/${userId}/enrolments`),
        loadWidgetData<unknown>("/doubts?mine=1&status=open"),
        loadWidgetData<Pick<StudentOverviewWidgets, "avgScore" | "attendancePct" | "recentScores">>(
          "/analytics/dashboard/student/overview",
        ),
      ]);

      if (enrolmentsResult.status === "rejected" || doubtsResult.status === "rejected" || overviewResult.status === "rejected") {
        // A retry reissues all three requests, so it must wait for the longest cooldown.
        const failures = [enrolmentsResult, doubtsResult, overviewResult]
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason as Error);
        throw failures.reduce((longest, error) =>
          (retryAfterAt(error) ?? 0) > (retryAfterAt(longest) ?? 0) ? error : longest);
      }

      const enrolments = enrolmentsResult.value;
      const doubts = doubtsResult.value;
      const overview = overviewResult.value;

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

      return {
        myCourses,
        avgScore: overview?.avgScore ?? 0,
        openDoubts,
        attendancePct: overview?.attendancePct ?? 0,
        recentScores: overview?.recentScores ?? { labels: [], datasets: [] },
      };
    },
  });

  return {
    widgets: query.data ?? EMPTY,
    isLoading: query.isPending,
    error: query.failureReason ?? query.error,
    isFetching: query.isFetching,
    refetch: () => query.refetch({ cancelRefetch: false }),
  };
}
