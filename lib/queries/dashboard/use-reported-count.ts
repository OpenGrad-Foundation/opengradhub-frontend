"use client";

import { useQuery } from "@tanstack/react-query";
import { getOpenReportedCount } from "@/lib/api";

const FIVE_MIN = 5 * 60_000;

/**
 * Count of bank questions with open student reports, for the dashboard StatCard.
 * `enabled` should be the caller's test_bank.manage_questions permission — the
 * endpoint is permission-gated, so ineligible roles must never call it.
 */
export function useOpenReportedCount(enabled: boolean): { count: number; isLoading: boolean } {
  const query = useQuery<number, Error>({
    queryKey: ["dashboard", "reported-count"],
    enabled,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: getOpenReportedCount,
  });
  return { count: query.data ?? 0, isLoading: query.isLoading };
}
