"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { FeedRow } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN";

type DoubtRow = {
  id: string;
  subject: string;
  status: string;
  student_name: string | null;
  answered_at: string | null;
  created_at: string;
};
type AnnouncementRow = { id: string; title: string; created_at: string };

/**
 * Activity feed merging the caller's role-scoped doubts (GET /doubts already
 * scopes: fellows see their schools, ZM/PM see doubts escalated to them,
 * super-admin sees all) with role-targeted announcements. Sorted newest-first,
 * capped at 20. Used by the FELLOW / PROGRAM_MANAGER / ZONAL_MANAGER /
 * SUPER_ADMIN activity tabs.
 */
export function useDoubtsActivity(role: Role, userId: string) {
  const qc = useQueryClient();
  const query = useQuery<FeedRow[], Error>({
    queryKey: qk.dashboardWidget(role, "activity", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [doubtsRes, annRes] = await Promise.all([
        apiFetch(`${API_BASE}/doubts`),
        apiFetch(`${API_BASE}/announcements`),
      ]);

      const doubts: DoubtRow[] = doubtsRes.ok ? await doubtsRes.json() : [];
      const anns: AnnouncementRow[] = annRes.ok ? await annRes.json() : [];

      const doubtItems: FeedRow[] = (Array.isArray(doubts) ? doubts : []).map((d) => ({
        ts: d.answered_at ?? d.created_at,
        kind: "doubt" as const,
        text:
          d.status === "ANSWERED"
            ? `Answered: ${d.subject}`
            : `New doubt${d.student_name ? ` from ${d.student_name}` : ""}: ${d.subject}`,
        href: `/dashboard/doubts/${d.id}`,
      }));

      const annItems: FeedRow[] = (Array.isArray(anns) ? anns : []).map((a) => ({
        ts: a.created_at,
        kind: "announcement" as const,
        text: a.title,
        href: "/dashboard/announcements",
      }));

      return [...doubtItems, ...annItems]
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
        .slice(0, 20);
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () => qc.invalidateQueries({ queryKey: qk.dashboard(role, "activity") }),
  };
}
