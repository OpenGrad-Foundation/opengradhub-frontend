"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";

const FIVE_MIN = 5 * 60_000;

export type OverviewWidgets = {
  stats: Array<{ key: string; label: string; value: number; helper?: string }>;
  chart: {
    title: string;
    variant: "line" | "bar";
    data: { labels: string[]; datasets: Array<{ label: string; data: number[] }> };
    emptyHelper: string;
  };
};

export type FeedRow = { ts: string; kind: "quiz" | "doubt" | "announcement"; text: string; href: string };

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN" | "GOVERNMENT" | "FUNDING_PARTNER";

export function useStubOverview(role: Role, userId: string, widgets: OverviewWidgets) {
  const query = useQuery<OverviewWidgets>({
    queryKey: qk.dashboardWidget(role, "overview", userId || "anon"),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => widgets,
  });
  return {
    widgets: query.data ?? widgets,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => query.refetch(),
  };
}

export function useStubActivity(role: Role, userId: string, items: FeedRow[]) {
  const query = useQuery<FeedRow[]>({
    queryKey: qk.dashboardWidget(role, "activity", userId || "anon"),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => items,
  });
  return {
    items: query.data ?? items,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => query.refetch(),
  };
}
