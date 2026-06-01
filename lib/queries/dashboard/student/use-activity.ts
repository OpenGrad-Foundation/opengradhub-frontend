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

type AnnouncementRow = {
  id: string;
  title: string;
  created_at?: string;
  published_at?: string;
};

export function useStudentActivity(userId: string) {
  const qc = useQueryClient();
  const query = useQuery<{ items: ActivityItem[] }, Error>({
    queryKey: qk.dashboardWidget("STUDENT", "activity", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // TODO(dashboard-backend): /analytics/dashboard/student/feed will merge
      // quiz/doubt/announcement events server-side. Until then we only have
      // announcements client-side.
      const res = await apiFetch(`${API_BASE}/announcements`);
      if (!res.ok) return { items: [] };
      const raw: unknown = await res.json();
      const rows = Array.isArray(raw) ? (raw as AnnouncementRow[]) : [];
      const items: ActivityItem[] = rows.slice(0, 20).map((r) => ({
        ts: r.published_at ?? r.created_at ?? new Date().toISOString(),
        kind: "announcement",
        text: r.title,
        href: "/dashboard/announcements",
      }));
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
