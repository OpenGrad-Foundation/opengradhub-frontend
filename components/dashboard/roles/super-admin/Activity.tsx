"use client";

import React from "react";
import GenericActivity from "../_GenericActivity";
import { useStubActivity } from "@/lib/queries/dashboard/_shared";

export default function SuperAdminActivity({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /users?recent=1, /permissions/audit, /announcements
  const { items, isLoading, error, refetch } = useStubActivity("SUPER_ADMIN", userId, []);
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
