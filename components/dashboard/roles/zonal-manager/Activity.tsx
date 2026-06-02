"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useDoubtsActivity } from "@/lib/queries/dashboard/_doubts-activity";

export default function ZMActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useDoubtsActivity("ZONAL_MANAGER", userId);
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
