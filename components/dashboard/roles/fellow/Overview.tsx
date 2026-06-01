"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useStubOverview } from "@/lib/queries/dashboard/_shared";

export default function FellowOverview({ userId }: { userId: string }) {
  // TODO(dashboard-backend): wire to /analytics/fellow/school + /doubts?assignee=me
  const stub = {
    stats: [
      { key: "students", label: "Assigned Students", value: 0, helper: "No students assigned yet" },
      { key: "schools", label: "Active Schools", value: 0, helper: "No schools assigned" },
      { key: "avg", label: "Avg Score (my students)", value: 0, helper: "Awaiting first submissions" },
      { key: "doubts", label: "Open Doubts to answer", value: 0, helper: "No open doubts" },
    ],
    chart: {
      title: "Weekly cohort score trend",
      variant: "line" as const,
      data: { labels: [], datasets: [] },
      emptyHelper: "Trend appears after first cohort submissions",
    },
  };
  const { widgets, isLoading, error, refetch } = useStubOverview("FELLOW", userId, stub);
  return <GenericOverview role="FELLOW" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
