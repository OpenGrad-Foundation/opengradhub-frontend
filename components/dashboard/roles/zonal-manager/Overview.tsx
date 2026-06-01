"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useStubOverview } from "@/lib/queries/dashboard/_shared";

export default function ZMOverview({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /analytics/schools?zone=me, /users?role=FELLOW&zone=me
  const stub = {
    stats: [
      { key: "schools", label: "Schools in Zone", value: 0, helper: "No schools in zone" },
      { key: "fellows", label: "Active Fellows", value: 0, helper: "No fellows assigned" },
      { key: "avg", label: "Avg Zone Score", value: 0, helper: "Awaiting submissions" },
      { key: "students", label: "Students in Zone", value: 0, helper: "No students enrolled" },
    ],
    chart: {
      title: "School-by-school score",
      variant: "bar" as const,
      data: { labels: [], datasets: [] },
      emptyHelper: "Bar chart appears once schools have scored submissions",
    },
  };
  const { widgets, isLoading, error, refetch } = useStubOverview("ZONAL_MANAGER", userId, stub);
  return <GenericOverview role="ZONAL_MANAGER" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
