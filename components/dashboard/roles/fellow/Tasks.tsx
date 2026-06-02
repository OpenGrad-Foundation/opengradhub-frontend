"use client";

import React from "react";
import GenericTasks from "../_GenericTasks";
import { useDoubtsTasks } from "@/lib/queries/dashboard/_doubts-tasks";

export default function FellowTasks({ userId }: { userId: string }) {
  const { tasks, isLoading, error, refetch } = useDoubtsTasks("FELLOW", userId);
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
