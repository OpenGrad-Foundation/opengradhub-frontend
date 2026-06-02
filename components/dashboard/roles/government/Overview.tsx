"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useInsightsOverview } from "@/lib/queries/dashboard/_insights-overview";

export default function GovernmentOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useInsightsOverview("GOVERNMENT", userId);
  return <GenericOverview role="GOVERNMENT" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
