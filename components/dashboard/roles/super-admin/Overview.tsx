"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useSuperAdminOverview } from "@/lib/queries/dashboard/super-admin/use-overview";
import { useOpenReportedCount } from "@/lib/queries/dashboard/use-reported-count";
import { withReportedStat } from "@/lib/queries/dashboard/_reported-stat";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";

export default function SuperAdminOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useSuperAdminOverview(userId);
  const canTriage = usePermission(PERM.test_bank.manage_questions);
  const { count } = useOpenReportedCount(canTriage);
  const merged = withReportedStat(widgets, { show: canTriage, count });
  return <GenericOverview role="SUPER_ADMIN" widgets={merged} isLoading={isLoading} error={error} refetch={refetch} />;
}
