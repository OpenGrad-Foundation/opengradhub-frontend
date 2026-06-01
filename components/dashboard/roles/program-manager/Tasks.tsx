"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { usePMTasks } from "@/lib/queries/dashboard/program-manager/use-tasks";

export default function PMTasks({ userId }: { userId: string }) {
  const { tasks, isLoading, error, refetch } = usePMTasks(userId);
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
