"use client";

import React from "react";
import ListCard from "@/components/dashboard/primitives/ListCard";
import TaskItem from "@/components/dashboard/primitives/TaskItem";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import { useStudentTasks } from "@/lib/queries/dashboard/student/use-tasks";

export default function StudentTasks({ userId }: { userId: string }) {
  const { tasks, nextLiveClass, isLoading, error, refetch } = useStudentTasks(userId);

  if (error) {
    return <WidgetError message={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard("STUDENT", "tasks")} />
      </div>
      <ListCard
        title="Next live class"
        isLoading={isLoading}
        emptyHelper="No upcoming live class"
      >
        {nextLiveClass ? (
          <TaskItem
            icon="live"
            title={nextLiveClass.title}
            subtitle={
              nextLiveClass.startsAt
                ? `Starts ${new Date(nextLiveClass.startsAt).toLocaleString()}`
                : undefined
            }
            actionHref={`/dashboard/live-classes/${nextLiveClass.id}`}
            actionLabel="Join"
          />
        ) : null}
      </ListCard>
      <ListCard
        title="To do"
        isLoading={isLoading}
        emptyHelper="No pending tasks — you're caught up"
      >
        {tasks.map((t) => (
          <TaskItem
            key={t.id}
            icon={t.kind}
            title={t.title}
            subtitle={t.subtitle}
            actionHref={t.href}
            actionLabel={t.kind === "doubt" ? "View" : "Open"}
          />
        ))}
      </ListCard>
    </div>
  );
}
