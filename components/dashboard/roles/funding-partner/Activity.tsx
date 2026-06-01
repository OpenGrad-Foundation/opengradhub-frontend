"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useStubActivity } from "@/lib/queries/dashboard/_shared";

export default function FundingPartnerActivity({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /announcements, /reports?funder=me
  const { items, isLoading, error, refetch } = useStubActivity("FUNDING_PARTNER", userId, []);
  return (
    <GenericActivity
      role="FUNDING_PARTNER"
      items={items}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No recent program updates"
    />
  );
}
