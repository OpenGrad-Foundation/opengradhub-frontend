"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useDoubtsActivity } from "@/lib/queries/dashboard/_doubts-activity";

export default function FellowActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useDoubtsActivity("FELLOW", userId);
  return (
    <GenericActivity
      role="FELLOW"
      items={items}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No recent submissions or escalations"
    />
  );
}
