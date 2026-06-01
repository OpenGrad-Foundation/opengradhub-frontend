"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useStubTasks } from "@/lib/queries/dashboard/_shared";

export default function PMTasks({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /analytics/dashboard/program-manager/tasks
  const { tasks, isLoading, error, refetch } = useStubTasks("PROGRAM_MANAGER", userId, []);
  return (
    <GenericTasks
      role="PROGRAM_MANAGER"
      tasks={tasks}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No escalations or pending approvals"
    />
  );
}
