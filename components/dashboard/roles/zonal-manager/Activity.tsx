"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useStubActivity } from "@/lib/queries/dashboard/_shared";

export default function ZMActivity({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /doubts?escalated=1&zone=me, /announcements
  const { items, isLoading, error, refetch } = useStubActivity("ZONAL_MANAGER", userId, []);
  return (
    <GenericActivity
      role="ZONAL_MANAGER"
      items={items}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No fellow updates or zonal escalations"
    />
  );
}
