"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { TaskRow } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type TasksResponse = {
  escalatedDoubts: Array<{ id: string; title: string }>;
  overdueCheckIns: Array<{ id: string; name: string }>;
};

function toTasks(r: TasksResponse): TaskRow[] {
  const doubts: TaskRow[] = (r.escalatedDoubts ?? []).map((d) => ({
    id: `doubt-${d.id}`,
    icon: "doubt",
    title: d.title,
    subtitle: "Escalated to you",
    href: `/dashboard/doubts?focus=${d.id}`,
    actionLabel: "Review",
  }));
  const checkIns: TaskRow[] = (r.overdueCheckIns ?? []).map((f) => ({
    id: `checkin-${f.id}`,
    icon: "system",
    title: f.name,
    subtitle: "Inactive 7+ days",
    href: `/dashboard/users/${f.id}`,
    actionLabel: "Nudge",
  }));
  return [...doubts, ...checkIns];
}

export function usePMTasks(userId: string) {
  const qc = useQueryClient();
  const query = useQuery<TaskRow[], Error>({
    queryKey: qk.dashboardWidget("PROGRAM_MANAGER", "tasks", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/analytics/dashboard/program-manager/tasks`);
      if (!res.ok) return [];
      const raw = (await res.json()) as TasksResponse;
      return toTasks(raw);
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard("PROGRAM_MANAGER", "tasks") }),
  };
}
