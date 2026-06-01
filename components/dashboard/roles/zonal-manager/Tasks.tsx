"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useStubTasks } from "@/lib/queries/dashboard/_shared";

export default function ZMTasks({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /doubts?escalated&zone, fellow check-ins, /analytics/schools?lowPerformers=1
  const { tasks, isLoading, error, refetch } = useStubTasks("ZONAL_MANAGER", userId, []);
  return (
    <GenericTasks
      role="ZONAL_MANAGER"
      tasks={tasks}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No escalations or overdue check-ins"
    />
  );
}
