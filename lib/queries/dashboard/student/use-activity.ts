"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

export type ActivityItem = {
  ts: string;
  kind: "quiz" | "doubt" | "announcement";
  text: string;
  href: string;
};

export function useStudentActivity(userId: string) {
  const qc = useQueryClient();
  const query = useQuery<{ items: ActivityItem[] }, Error>({
    queryKey: qk.dashboardWidget("STUDENT", "activity", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Server merges quiz results, doubt replies, and student-targeted
      // announcements into one reverse-chronological feed (capped at 20).
      const res = await apiFetch(`${API_BASE}/analytics/dashboard/student/feed`);
      if (!res.ok) return { items: [] };
      const raw: unknown = await res.json();
      const items =
        raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
          ? (raw as { items: ActivityItem[] }).items
          : [];
      return { items };
    },
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () =>
      qc.invalidateQueries({ queryKey: qk.dashboard("STUDENT", "activity") }),
  };
}
