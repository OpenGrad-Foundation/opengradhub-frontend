"use client";

import React from "react";
import ListCard from "@/components/dashboard/primitives/ListCard";
import TaskItem from "@/components/dashboard/primitives/TaskItem";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import type { TaskRow } from "@/lib/queries/dashboard/_shared";

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN" | "GOVERNMENT" | "FUNDING_PARTNER";

type Props = {
  role: Role;
  tasks: TaskRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  emptyHelper: string;
};

export default function GenericTasks({ role, tasks, isLoading, error, refetch, emptyHelper }: Props) {
  if (error) return <WidgetError message={error} onRetry={refetch} />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard(role, "tasks")} />
      </div>
      <ListCard title="To do" isLoading={isLoading} emptyHelper={emptyHelper}>
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            icon={t.icon}
            title={t.title}
            subtitle={t.subtitle}
            actionHref={t.href}
            actionLabel={t.actionLabel}
          />
        ))}
      </ListCard>
    </div>
  );
}
