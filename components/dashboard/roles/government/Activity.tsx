"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useAnnouncementsFeed } from "@/lib/queries/dashboard/_announcements-feed";

export default function GovernmentActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useAnnouncementsFeed("GOVERNMENT", userId);
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
