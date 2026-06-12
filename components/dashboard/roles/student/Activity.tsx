"use client";

import React from "react";
import ListCard from "@/components/dashboard/primitives/ListCard";
import FeedItem from "@/components/dashboard/primitives/FeedItem";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import { useStudentActivity } from "@/lib/queries/dashboard/student/use-activity";

export default function StudentActivity({ userId }: { userId: string }) {
  const { items, isLoading, error, refetch } = useStudentActivity(userId);

  if (error) {
    return <WidgetError message={error} onRetry={refetch} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard("STUDENT", "activity")} onRefresh={refetch} />
      </div>
      <ListCard
        title="Recent activity"
        isLoading={isLoading}
        emptyHelper="No recent activity — submit a quiz to see updates here"
      >
        {items.map((it, i) => (
          <FeedItem
            key={`${it.ts}-${i}`}
            icon={it.kind}
            text={it.text}
            timestamp={new Date(it.ts).toLocaleString()}
            href={it.href}
          />
        ))}
      </ListCard>
    </div>
  );
}
