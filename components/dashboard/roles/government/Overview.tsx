"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useStubOverview } from "@/lib/queries/dashboard/_shared";

export default function GovernmentOverview({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /analytics/insights?region=me, /analytics/filters/states
  const stub = {
    stats: [
      { key: "students", label: "Total Students (region)", value: 0, helper: "No regional data yet" },
      { key: "schools", label: "Total Schools", value: 0, helper: "No schools in region" },
      { key: "avg", label: "Avg Score (region)", value: 0, helper: "Awaiting submissions" },
      { key: "programs", label: "Programs Running", value: 0, helper: "No active programs" },
    ],
    chart: {
      title: "State / district performance",
      variant: "bar" as const,
      data: { labels: [], datasets: [] },
      emptyHelper: "Bar chart appears once schools report results",
    },
  };
  const { widgets, isLoading, error, refetch } = useStubOverview("GOVERNMENT", userId, stub);
  return <GenericOverview role="GOVERNMENT" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
