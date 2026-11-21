"use client";

import React from "react";
import StatCard from "@/components/dashboard/primitives/StatCard";
import ChartCard from "@/components/dashboard/primitives/ChartCard";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import { useStudentOverview } from "@/lib/queries/dashboard/student/use-overview";
import { useMyAttendance } from "@/lib/queries/attendance";
import { retryAfterAt } from "@/lib/queries/retry";

export default function StudentOverview({ userId }: { userId: string }) {
  const { widgets, isLoading, error, isFetching, refetch } = useStudentOverview(userId);

  /**
   * ONE attendance number, from the canonical API — whichever store is
   * authoritative for this student's cohorts. Kept card-local on purpose:
   * /attendance/me failing must not blank courses, scores and doubts, so it
   * never feeds the whole-widget error path below.
   */
  const myAttendance = useMyAttendance();
  const totals = (myAttendance.data?.series ?? []).reduce(
    (acc, s) => ({ present: acc.present + s.summary.present, marked: acc.marked + s.summary.marked }),
    { present: 0, marked: 0 },
  );
  const attendancePct = totals.marked === 0 ? null : Math.round((totals.present / totals.marked) * 100);

  if (error) {
    return <WidgetError message="Couldn't load your overview." onRetry={refetch} retryAt={retryAfterAt(error)} isFetching={isFetching} />;
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
        {/* One number, not two: whichever store is authoritative for this
            student answers it. Two side-by-side percentages read as one figure
            contradicting itself, which is what this consolidation removed. */}
        {myAttendance.isError || myAttendance.failureReason ? (
          <WidgetError
            message="Couldn't load attendance."
            onRetry={() => void myAttendance.refetch({ cancelRefetch: false })}
            retryAt={retryAfterAt(myAttendance.failureReason ?? myAttendance.error)}
            isFetching={myAttendance.isFetching}
          />
        ) : (
          <StatCard
            label="Attendance"
            value={attendancePct}
            isLoading={myAttendance.isPending}
            helperText={attendancePct === null ? "No attendance recorded yet" : undefined}
          />
        )}
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
