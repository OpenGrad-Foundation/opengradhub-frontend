"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useStubTasks } from "@/lib/queries/dashboard/_shared";

export default function SuperAdminTasks({ userId }: { userId: string }) {
  // TODO(dashboard-backend): /users?pendingApproval=1, /courses/enrolments?expired=1, /doubts?priority=critical
  const { tasks, isLoading, error, refetch } = useStubTasks("SUPER_ADMIN", userId, []);
  return (
    <GenericTasks
      role="SUPER_ADMIN"
      tasks={tasks}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No pending approvals or critical alerts"
    />
  );
}
