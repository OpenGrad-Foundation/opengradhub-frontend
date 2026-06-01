"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useStubOverview } from "@/lib/queries/dashboard/_shared";

export default function SuperAdminOverview({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /analytics/dashboard/super-admin/overview + DAU/MAU series
  const stub = {
    stats: [
      { key: "users", label: "Total Users", value: 0, helper: "No users yet" },
      { key: "courses", label: "Active Courses", value: 0, helper: "No active courses" },
      { key: "schools", label: "Schools", value: 0, helper: "No schools onboarded" },
      { key: "doubts", label: "Open Doubts (system)", value: 0, helper: "No open doubts" },
    ],
    chart: {
      title: "DAU / MAU (last 30 days)",
      variant: "line" as const,
      data: { labels: [], datasets: [] },
      emptyHelper: "Series appears after first day of activity",
    },
  };
  const { widgets, isLoading, error, refetch } = useStubOverview("SUPER_ADMIN", userId, stub);
  return <GenericOverview role="SUPER_ADMIN" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
