"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useDoubtsTasks } from "@/lib/queries/dashboard/_doubts-tasks";

export default function ZMTasks({ userId }: { userId: string }) {
  const { tasks, isLoading, error, refetch } = useDoubtsTasks("ZONAL_MANAGER", userId);
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
