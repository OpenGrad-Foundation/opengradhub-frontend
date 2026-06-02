"use client";

import React from "react";
import StatCard from "@/components/dashboard/primitives/StatCard";
import ChartCard from "@/components/dashboard/primitives/ChartCard";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import { useStudentOverview } from "@/lib/queries/dashboard/student/use-overview";

export default function StudentOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useStudentOverview(userId);

  if (error) {
    return <WidgetError message={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard("STUDENT", "overview")} />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Courses"
          value={widgets.myCourses}
          isLoading={isLoading}
          helperText={widgets.myCourses === 0 ? "No courses enrolled yet" : undefined}
        />
        <StatCard
          label="Avg Score"
          value={widgets.avgScore}
          isLoading={isLoading}
          helperText={widgets.avgScore === 0 ? "Take a quiz to see your score" : undefined}
        />
        <StatCard
          label="Open Doubts"
          value={widgets.openDoubts}
          isLoading={isLoading}
          helperText={widgets.openDoubts === 0 ? "No open doubts" : undefined}
        />
        <StatCard
          label="Attendance %"
          value={widgets.attendancePct}
          isLoading={isLoading}
          helperText={widgets.attendancePct === 0 ? "No live classes attended yet" : undefined}
        />
      </div>
      <ChartCard
        title="Recent quiz scores"
        variant="line"
        data={widgets.recentScores}
        isLoading={isLoading}
        emptyHelper="Take quizzes to see your trend"
      />
    </div>
  );
}
