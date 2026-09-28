"use client";

import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { getOpenReportedCount } from "@/lib/api";
import { qk } from "@/lib/queries/keys";

const FIVE_MIN = 5 * 60_000;

/**
 * Count of bank questions with open student reports, for the dashboard StatCard.
 * Both report management and student visibility are required, including when
 * a caller passes enabled=true or a previous result remains cached.
 */
export function useOpenReportedCount(enabled: boolean): { count: number; isLoading: boolean } {
  const { hasAll } = usePermissions();
  const canRead = enabled && hasAll(PERM.test_bank.manage_questions, PERM.students.view);
  const query = useQuery<number, Error>({
    queryKey: qk.openReportedCount(),
    enabled: canRead,
    staleTime: FIVE_MIN,
    refetchOnWindowFocus: false,
    queryFn: getOpenReportedCount,
  });
  return { count: canRead ? query.data ?? 0 : 0, isLoading: canRead && query.isLoading };
}
