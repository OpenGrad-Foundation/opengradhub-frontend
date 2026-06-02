"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useSuperAdminTasks } from "@/lib/queries/dashboard/super-admin/use-tasks";

export default function SuperAdminTasks({ userId }: { userId: string }) {
  const { tasks, isLoading, error, refetch } = useSuperAdminTasks(userId);
  return (
    <GenericTasks
      role="SUPER_ADMIN"
      tasks={tasks}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No pending approvals or open doubts"
    />
  );
}
