"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useInsightsOverview } from "@/lib/queries/dashboard/_insights-overview";

export default function FellowOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useInsightsOverview("FELLOW", userId);
  return <GenericOverview role="FELLOW" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
