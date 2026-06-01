"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useStubOverview } from "@/lib/queries/dashboard/_shared";

export default function PMOverview({ userId }: { userId: string }) {
  // TODO(dashboard-backend): wire to /analytics/manager + active courses + assessments
  const stub = {
    stats: [
      { key: "students", label: "Total Students (program)", value: 0, helper: "No enrolments yet" },
      { key: "courses", label: "Active Courses", value: 0, helper: "No active courses" },
      { key: "avg", label: "Avg Program Score", value: 0, helper: "Awaiting first submissions" },
      { key: "assess", label: "Active Assessments", value: 0, helper: "No assessments published" },
    ],
    chart: {
      title: "Monthly enrolment vs completion",
      variant: "line" as const,
      data: { labels: [], datasets: [] },
      emptyHelper: "Chart appears after first month of activity",
    },
  };
  const { widgets, isLoading, error, refetch } = useStubOverview("PROGRAM_MANAGER", userId, stub);
  return <GenericOverview role="PROGRAM_MANAGER" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
