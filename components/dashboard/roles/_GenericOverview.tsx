"use client";

import React from "react";
import StatCard from "@/components/dashboard/primitives/StatCard";
import ChartCard from "@/components/dashboard/primitives/ChartCard";
import RefreshButton from "@/components/dashboard/primitives/RefreshButton";
import WidgetError from "@/components/dashboard/primitives/WidgetError";
import { qk } from "@/lib/queries/keys";
import type { OverviewWidgets } from "@/lib/queries/dashboard/_shared";

type Role = "FELLOW" | "PROGRAM_MANAGER" | "ZONAL_MANAGER" | "SUPER_ADMIN" | "GOVERNMENT" | "FUNDING_PARTNER";

type Props = {
  role: Role;
  widgets: OverviewWidgets;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export default function GenericOverview({ role, widgets, isLoading, error, refetch }: Props) {
  if (error) return <WidgetError message={error} onRetry={refetch} />;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <RefreshButton queryKey={qk.dashboard(role, "overview")} />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {widgets.stats.map((s) => (
          <StatCard
            key={s.key}
            label={s.label}
            value={s.value}
            isLoading={isLoading}
            helperText={s.value === 0 ? s.helper : undefined}
          />
        ))}
      </div>
      <ChartCard
        title={widgets.chart.title}
        variant={widgets.chart.variant}
        data={widgets.chart.data}
        isLoading={isLoading}
        emptyHelper={widgets.chart.emptyHelper}
      />
    </div>
  );
}
