"use client";

import React from "react";
import ListCard from "@/components/dashboard/primitives/ListCard";
import FeedItem from "@/components/dashboard/primitives/FeedItem";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import type { FeedRow } from "@/lib/queries/dashboard/_shared";

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN" | "GOVERNMENT" | "FUNDING_PARTNER";

type Props = {
  role: Role;
  items: FeedRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  emptyHelper: string;
};

export default function GenericActivity({ role, items, isLoading, error, refetch, emptyHelper }: Props) {
  if (error) return <WidgetError message={error} onRetry={refetch} />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard(role, "activity")} onRefresh={refetch} />
      </div>
      <ListCard title="Recent activity" isLoading={isLoading} emptyHelper={emptyHelper}>
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
