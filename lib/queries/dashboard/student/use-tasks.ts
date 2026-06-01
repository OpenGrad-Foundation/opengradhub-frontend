"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FIVE_MIN = 5 * 60_000;

export type StudentTask = {
  id: string;
  title: string;
  subtitle?: string;
  kind: "quiz" | "doubt";
  href: string;
};

export type NextLiveClass = {
  id: string;
  title: string;
  startsAt: string;
} | null;

type QuizRow = { id: string; title: string; due_at?: string };
type DoubtRow = { id: string; title?: string; question?: string };
type LiveClassRow = {
  id: string;
  title: string;
  starts_at?: string;
  scheduled_at?: string;
};

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export function useStudentTasks(userId: string) {
  const qc = useQueryClient();
  const query = useQuery<{ tasks: StudentTask[]; nextLiveClass: NextLiveClass }, Error>({
    queryKey: qk.dashboardWidget("STUDENT", "tasks", userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [quizzesRes, doubtsRes, liveNextRes] = await Promise.all([
        apiFetch(`${API_BASE}/quizzes/available`),
        apiFetch(`${API_BASE}/doubts?mine=1&status=open`),
        apiFetch(`${API_BASE}/live-classes/next`),
      ]);

      const quizzesRaw = await safeJson<unknown>(quizzesRes, []);
      const doubtsRaw = await safeJson<unknown>(doubtsRes, []);
      const liveNextRaw = await safeJson<unknown>(liveNextRes, null);

      const quizzes: QuizRow[] = Array.isArray(quizzesRaw)
        ? (quizzesRaw as QuizRow[])
        : Array.isArray((quizzesRaw as { items?: QuizRow[] })?.items)
          ? (quizzesRaw as { items: QuizRow[] }).items
          : [];

      const doubts: DoubtRow[] = Array.isArray(doubtsRaw)
        ? (doubtsRaw as DoubtRow[])
        : Array.isArray((doubtsRaw as { items?: DoubtRow[] })?.items)
          ? (doubtsRaw as { items: DoubtRow[] }).items
          : [];

      const tasks: StudentTask[] = [
        ...quizzes.slice(0, 10).map((q) => ({
          id: q.id,
          title: q.title,
          subtitle: q.due_at ? `Due ${new Date(q.due_at).toLocaleDateString()}` : undefined,
          kind: "quiz" as const,
          href: `/dashboard/quiz/${q.id}`,
        })),
        ...doubts.slice(0, 10).map((d) => ({
          id: d.id,
          title: d.title ?? d.question ?? "Doubt",
          kind: "doubt" as const,
          href: `/dashboard/doubts`,
        })),
      ];

      let nextLiveClass: NextLiveClass = null;
      if (liveNextRaw && typeof liveNextRaw === "object") {
        const row = liveNextRaw as LiveClassRow;
        if (row.id && row.title) {
          nextLiveClass = {
            id: row.id,
            title: row.title,
            startsAt: row.starts_at ?? row.scheduled_at ?? "",
          };
        }
      }

      return { tasks, nextLiveClass };
    },
  });

  return {
    tasks: query.data?.tasks ?? [],
    nextLiveClass: query.data?.nextLiveClass ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch: () =>
      qc.invalidateQueries({ queryKey: qk.dashboard("STUDENT", "tasks") }),
  };
}
