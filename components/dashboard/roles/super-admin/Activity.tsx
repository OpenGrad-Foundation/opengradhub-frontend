"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useDoubtsActivity } from "@/lib/queries/dashboard/_doubts-activity";

export default function SuperAdminActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useDoubtsActivity("SUPER_ADMIN", userId);
  return (
    <GenericActivity
      role="SUPER_ADMIN"
      items={items}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No recent signups or system events"
    />
  );
}
