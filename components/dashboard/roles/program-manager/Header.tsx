"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/queries/keys";
import { useInsightsOverview } from "@/lib/queries/dashboard/_insights-overview";
import WorkspaceHeader from "@/components/dashboard/WorkspaceHeader";
import styles from "@/components/dashboard/workspace.module.css";

export default function PMDashboardHeader({ userId, onMenuClick, sidebarOpen = false }: { userId: string; onMenuClick?: () => void; sidebarOpen?: boolean }) {
  const { widgets, isLoading, error } = useInsightsOverview("PROGRAM_MANAGER", userId);
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      // Invalidation refetches active, enabled queries and leaves other tabs
      // ready to refresh when opened, preserving each query's access checks.
      await Promise.all([
        qk.dashboardWidget("PROGRAM_MANAGER", "overview", userId),
        qk.dashboardWidget("PROGRAM_MANAGER", "activity", userId),
        qk.attendanceGaps(),
        qk.openReportedCount(),
      ].map(queryKey => client.invalidateQueries({ queryKey })));
    } finally {
      setRefreshing(false);
    }
  }

  const programmeName = isLoading ? "Loading programme…" : widgets.scopeLabel || (error ? "Programme unavailable" : "Your assigned scope");

  return <WorkspaceHeader title="Dashboard" subtitle={programmeName} subtitleLabel="Programme" onMenuClick={onMenuClick} sidebarOpen={sidebarOpen} actions={
    <button type="button" onClick={() => void refresh()} disabled={refreshing} aria-label={refreshing ? "Refreshing dashboard" : "Refresh dashboard"} title="Refresh dashboard" className={`${styles.utilityButton} ${styles.iconButton} disabled:opacity-50`}>
      <RefreshCw aria-hidden="true" size={20} className={refreshing ? "motion-safe:animate-spin" : ""} />
    </button>
  } />;
}
