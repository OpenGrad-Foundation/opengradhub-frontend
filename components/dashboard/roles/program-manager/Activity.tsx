"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useDoubtsActivity } from "@/lib/queries/dashboard/_doubts-activity";

export default function PMActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useDoubtsActivity("PROGRAM_MANAGER", userId);
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
