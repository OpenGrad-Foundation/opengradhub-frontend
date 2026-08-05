"use client";

import React from "react";
import StatCard from "@/components/dashboard/primitives/StatCard";
import ChartCard from "@/components/dashboard/primitives/ChartCard";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import { useStudentOverview } from "@/lib/queries/dashboard/student/use-overview";
import { useMyAttendance } from "@/lib/queries/attendance";

export default function StudentOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, refetch } = useStudentOverview(userId);

  /**
   * Register attendance is a second, independent source. Kept card-local on
   * purpose: /attendance/me failing must not blank courses, scores and doubts,
   * so it never feeds the whole-widget error path below.
   */
  const myAttendance = useMyAttendance();
  const registerPct = myAttendance.data?.register.percent ?? null;

  if (error) {
    return <WidgetError message={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard("STUDENT", "overview")} onRefresh={refetch} />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
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
        {/* Two different attendance streams, so both say which one they are —
            unlabelled they'd read as one number contradicting itself. */}
        <StatCard
          label="Live class %"
          value={widgets.attendancePct}
          isLoading={isLoading}
          helperText={widgets.attendancePct === 0 ? "No live classes attended yet" : undefined}
        />
        <StatCard
          label="Register %"
          value={registerPct ?? 0}
          isLoading={myAttendance.isLoading}
          helperText={
            myAttendance.isError
              ? "Couldn't load register attendance"
              : registerPct === null
                ? "No register attendance recorded yet"
                : undefined
          }
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
