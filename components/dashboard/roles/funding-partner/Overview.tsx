"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useStubOverview } from "@/lib/queries/dashboard/_shared";

export default function FundingPartnerOverview({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /analytics/insights?funder=me, /courses?funder=me
  const stub = {
    stats: [
      { key: "programs", label: "Funded Programs", value: 0, helper: "No funded programs yet" },
      { key: "students", label: "Students Reached", value: 0, helper: "No enrolments in funded cohorts" },
      { key: "avg", label: "Avg Score (funded)", value: 0, helper: "Awaiting submissions" },
      { key: "completion", label: "Completion %", value: 0, helper: "Awaiting cohort progress" },
    ],
    chart: {
      title: "Program completion trend",
      variant: "line" as const,
      data: { labels: [], datasets: [] },
      emptyHelper: "Trend appears as cohorts complete content",
    },
  };
  const { widgets, isLoading, error, refetch } = useStubOverview("FUNDING_PARTNER", userId, stub);
  return <GenericOverview role="FUNDING_PARTNER" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
