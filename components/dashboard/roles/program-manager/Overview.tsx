"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useInsightsOverview } from "@/lib/queries/dashboard/_insights-overview";

export default function PMOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useInsightsOverview("PROGRAM_MANAGER", userId);
  return <GenericOverview role="PROGRAM_MANAGER" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
