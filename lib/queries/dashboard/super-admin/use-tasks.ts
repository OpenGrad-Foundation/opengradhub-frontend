"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { TaskRow } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type TasksResponse = {
  pendingApprovals: Array<{ id: string; title: string; created_by_name: string | null }>;
  openDoubts: Array<{ id: string; title: string }>;
};

function toTasks(r: TasksResponse): TaskRow[] {
  const approvals: TaskRow[] = (r.pendingApprovals ?? []).map((c) => ({
    id: `approval-${c.id}`,
    icon: "review",
    title: c.title,
    subtitle: c.created_by_name ? `Submitted by ${c.created_by_name}` : "Awaiting approval",
    href: `/dashboard/courses/${c.id}`,
    actionLabel: "Approve",
  }));
  const doubts: TaskRow[] = (r.openDoubts ?? []).map((d) => ({
    id: `doubt-${d.id}`,
    icon: "doubt",
    title: d.title,
    subtitle: "Open doubt",
    href: `/dashboard/doubts/${d.id}`,
    actionLabel: "Review",
  }));
  return [...approvals, ...doubts];
}

export function useSuperAdminTasks(userId: string) {
  const qc = useQueryClient();
  const query = useQuery<TaskRow[], Error>({
    queryKey: qk.dashboardWidget("SUPER_ADMIN", "tasks", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/analytics/dashboard/super-admin/tasks`);
      if (!res.ok) return [];
      const raw = (await res.json()) as TasksResponse;
      return toTasks(raw);
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard("SUPER_ADMIN", "tasks") }),
  };
}
