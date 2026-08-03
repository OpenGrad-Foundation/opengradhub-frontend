"use client";

import React from 'react';
import { Tabs } from './Tabs';

export type DashboardTab = 'overview' | 'activity';

type DashboardTabsProps = {
  overview: React.ReactNode;
  activity: React.ReactNode;
};

/**
 * The role dashboard's Overview/Activity tabs — a thin wrapper over the shared
 * `Tabs` primitive, kept so the seven call sites in RoleDashboard keep their
 * existing two-slot API.
 */
export default function DashboardTabs({ overview, activity }: DashboardTabsProps) {
  return (
    <Tabs
      ariaLabel="Dashboard tabs"
      tabs={[
        { key: 'overview', label: 'Overview', panel: overview },
        { key: 'activity', label: 'Activity', panel: activity },
      ]}
    />
  );
}
