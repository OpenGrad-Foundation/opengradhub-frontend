"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";
import type { FeedRow } from "@/lib/queries/dashboard/_shared";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
// Thirty seconds, and refetch on focus.
//
// This feed used to be a convenience: a ZM or PM learned about a doubt from a
// DOUBT_ESCALATED notification, and the dashboard was where they went next. That
// notification is gone with the escalation ladder, and the same people now see
// every doubt in their chain the moment it is asked — so this list IS the
// signal, and a five-minute stale window with no refetch on focus meant sitting
// on a tab that quietly stopped being true.
const THIRTY_SEC = 30_000;

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
 * Activity feed merging the caller's scoped doubts (GET /doubts scopes them:
 * the author, a seated member of the doubt's programme, the in-charge of the
 * school it was asked in and their manager chain, and unrestricted) with
 * role-targeted announcements. Sorted newest-first, capped at 20. Used by the
 * FELLOW / PROGRAM_MANAGER / ZONAL_MANAGER / SUPER_ADMIN activity tabs.
 */
export function useDoubtsActivity(role: Role, userId: string) {
  const query = useQuery<FeedRow[], Error>({
    queryKey: qk.dashboardWidget(role, "activity", userId),
    enabled: !!userId,
    staleTime: THIRTY_SEC,
    refetchOnWindowFocus: true,
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
        href: `/dashboard/doubts?focus=${d.id}`,
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
    refetch: () => query.refetch(),
  };
}
