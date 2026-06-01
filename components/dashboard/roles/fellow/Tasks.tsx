"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useStubTasks } from "@/lib/queries/dashboard/_shared";

export default function FellowTasks({ userId }: { userId: string }) {
  // TODO(dashboard-backend): doubts to answer, low-performers, live classes I host
  const { tasks, isLoading, error, refetch } = useStubTasks("FELLOW", userId, []);
  return (
    <GenericTasks
      role="FELLOW"
      tasks={tasks}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
      emptyHelper="No pending tasks"
    />
  );
}
