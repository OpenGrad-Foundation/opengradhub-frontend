"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useStubActivity } from "@/lib/queries/dashboard/_shared";

export default function GovernmentActivity({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /announcements
  const { items, isLoading, error, refetch } = useStubActivity("GOVERNMENT", userId, []);
  return (
    <GenericActivity
      role="GOVERNMENT"
      items={items}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No recent announcements"
    />
  );
}
