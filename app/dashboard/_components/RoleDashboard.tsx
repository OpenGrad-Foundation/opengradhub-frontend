"use client";

import React from 'react';
import DashboardTabs from './DashboardTabs';
import EmptyState from '@/components/dashboard/primitives/EmptyState';
import StudentOverview from '@/components/dashboard/roles/student/Overview';
import StudentActivity from '@/components/dashboard/roles/student/Activity';
import StudentTasks from '@/components/dashboard/roles/student/Tasks';

type Role =
  | 'STUDENT'
  | 'FELLOW'
  | 'PROGRAM_MANAGER'
  | 'ZONAL_MANAGER'
  | 'SUPER_ADMIN'
  | 'GOVERNMENT'
  | 'FUNDING_PARTNER';

const placeholder = (label: string) => (
  <EmptyState helperText={`${label} — coming soon`} />
);

export default function RoleDashboard({
  role,
  programmeType,
  userId,
}: {
  role: string;
  programmeType?: string | null;
  userId?: string;
}) {
  const dispatchers: Record<Role, React.ReactNode> = {
    STUDENT: (
      <DashboardTabs
        overview={<StudentOverview userId={userId ?? ''} />}
        activity={<StudentActivity userId={userId ?? ''} />}
        tasks={<StudentTasks userId={userId ?? ''} />}
      />
    ),
    FELLOW: (
      <DashboardTabs
        overview={placeholder('Fellow Overview')}
        activity={placeholder('Fellow Activity')}
        tasks={placeholder('Fellow Tasks')}
      />
    ),
    PROGRAM_MANAGER: (
      <DashboardTabs
        overview={placeholder('PM Overview')}
        activity={placeholder('PM Activity')}
        tasks={placeholder('PM Tasks')}
      />
    ),
    ZONAL_MANAGER: (
      <DashboardTabs
        overview={placeholder('ZM Overview')}
        activity={placeholder('ZM Activity')}
        tasks={placeholder('ZM Tasks')}
      />
    ),
    SUPER_ADMIN: (
      <DashboardTabs
        overview={placeholder('Super Admin Overview')}
        activity={placeholder('Super Admin Activity')}
        tasks={placeholder('Super Admin Tasks')}
      />
    ),
    GOVERNMENT: (
      <DashboardTabs
        overview={placeholder('Government Overview')}
        activity={placeholder('Government Activity')}
        tasks={<EmptyState helperText="Read-only role — no tasks" />}
      />
    ),
    FUNDING_PARTNER: (
      <DashboardTabs
        overview={placeholder('Funding Partner Overview')}
        activity={placeholder('Funding Partner Activity')}
        tasks={<EmptyState helperText="Read-only role — no tasks" />}
      />
    ),
  };

  const node = dispatchers[role as Role];
  if (!node) return <EmptyState helperText="No dashboard for this role" />;

  void programmeType;
  void userId;
  return <>{node}</>;
}
