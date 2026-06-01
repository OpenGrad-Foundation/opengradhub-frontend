"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useStubActivity } from "@/lib/queries/dashboard/_shared";

export default function FellowActivity({ userId }: { userId: string }) {
  // TODO(dashboard-backend): wire to /quizzes/recent-submissions, /doubts?escalated, /announcements
  const { items, isLoading, error, refetch } = useStubActivity("FELLOW", userId, []);
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
