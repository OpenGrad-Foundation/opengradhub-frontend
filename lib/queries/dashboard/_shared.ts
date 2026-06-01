"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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
export type TaskRow = {
  id: string;
  icon: "doubt" | "quiz" | "live" | "review" | "system";
  title: string;
  subtitle?: string;
  href: string;
  actionLabel: string;
};

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN" | "GOVERNMENT" | "FUNDING_PARTNER";

export function useStubOverview(role: Role, userId: string, widgets: OverviewWidgets) {
  const qc = useQueryClient();
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
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard(role, "overview") }),
  };
}

export function useStubActivity(role: Role, userId: string, items: FeedRow[]) {
  const qc = useQueryClient();
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
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard(role, "activity") }),
  };
}

export function useStubTasks(role: Role, userId: string, tasks: TaskRow[]) {
  const qc = useQueryClient();
  const query = useQuery<TaskRow[]>({
    queryKey: qk.dashboardWidget(role, "tasks", userId || "anon"),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => tasks,
  });
  return {
    tasks: query.data ?? tasks,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard(role, "tasks") }),
  };
}
