"use client";

import React from "react";
import GenericOverview from "../_GenericOverview";
import { useInsightsOverview } from "@/lib/queries/dashboard/_insights-overview";

export default function FundingPartnerOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useInsightsOverview("FUNDING_PARTNER", userId);
  return <GenericOverview role="FUNDING_PARTNER" widgets={widgets} isLoading={isLoading} error={error} refetch={refetch} />;
}
