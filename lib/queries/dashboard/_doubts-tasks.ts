"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { TaskRow } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type Role = "FELLOW" | "ZONAL_MANAGER";

type DoubtRow = {
  id: string;
  subject: string;
  status: string;
  student_name: string | null;
  school_name: string | null;
};

/**
 * Tasks list of open doubts awaiting the caller's response. GET /doubts is
 * already role-scoped (fellows → their schools, ZM → doubts escalated to
 * them); we keep only the OPEN ones. Used by the FELLOW / ZONAL_MANAGER
 * tasks tabs.
 */
export function useDoubtsTasks(role: Role, userId: string) {
  const qc = useQueryClient();
  const query = useQuery<TaskRow[], Error>({
    queryKey: qk.dashboardWidget(role, "tasks", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/doubts`);
      if (!res.ok) return [];
      const raw: unknown = await res.json();
      const rows = Array.isArray(raw) ? (raw as DoubtRow[]) : [];
      return rows
        .filter((d) => d.status === "OPEN")
        .map((d) => ({
          id: `doubt-${d.id}`,
          icon: "doubt" as const,
          title: d.subject,
          subtitle: [d.student_name, d.school_name].filter(Boolean).join(" · ") || undefined,
          href: `/dashboard/doubts?focus=${d.id}`,
          actionLabel: "Answer",
        }));
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard(role, "tasks") }),
  };
}
