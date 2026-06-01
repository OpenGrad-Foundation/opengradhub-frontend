"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useStubActivity } from "@/lib/queries/dashboard/_shared";

export default function PMActivity({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /schools?recent=1, /doubts?escalated=1, /announcements
  const { items, isLoading, error, refetch } = useStubActivity("PROGRAM_MANAGER", userId, []);
  return (
    <GenericActivity
      role="PROGRAM_MANAGER"
      items={items}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No recent program activity"
    />
  );
}
