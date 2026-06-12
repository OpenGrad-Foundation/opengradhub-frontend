"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { FeedRow } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN" | "GOVERNMENT" | "FUNDING_PARTNER";

type AnnouncementRow = { id: string; title: string; created_at: string };

/**
 * Activity feed backed by /announcements (server filters to the caller's
 * role). Used by role tabs whose only available activity source today is
 * announcements; richer per-role events are added as their endpoints land.
 */
export function useAnnouncementsFeed(role: Role, userId: string) {
  const query = useQuery<FeedRow[], Error>({
    queryKey: qk.dashboardWidget(role, "activity", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await apiFetch(`${API_BASE}/announcements`);
      if (!res.ok) return [];
      const raw: unknown = await res.json();
      const rows = Array.isArray(raw) ? (raw as AnnouncementRow[]) : [];
      return rows.slice(0, 20).map((r) => ({
        ts: r.created_at,
        kind: "announcement" as const,
        text: r.title,
        href: "/dashboard/announcements",
      }));
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => query.refetch(),
  };
}
