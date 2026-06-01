"use client";

import React from 'react';
import DashboardTabs from './DashboardTabs';
import EmptyState from '@/components/dashboard/primitives/EmptyState';

import StudentOverview from '@/components/dashboard/roles/student/Overview';
import StudentActivity from '@/components/dashboard/roles/student/Activity';
import StudentTasks from '@/components/dashboard/roles/student/Tasks';

import FellowOverview from '@/components/dashboard/roles/fellow/Overview';
import FellowActivity from '@/components/dashboard/roles/fellow/Activity';
import FellowTasks from '@/components/dashboard/roles/fellow/Tasks';

import PMOverview from '@/components/dashboard/roles/program-manager/Overview';
import PMActivity from '@/components/dashboard/roles/program-manager/Activity';
import PMTasks from '@/components/dashboard/roles/program-manager/Tasks';

import ZMOverview from '@/components/dashboard/roles/zonal-manager/Overview';
import ZMActivity from '@/components/dashboard/roles/zonal-manager/Activity';
import ZMTasks from '@/components/dashboard/roles/zonal-manager/Tasks';

import SuperAdminOverview from '@/components/dashboard/roles/super-admin/Overview';
import SuperAdminActivity from '@/components/dashboard/roles/super-admin/Activity';
import SuperAdminTasks from '@/components/dashboard/roles/super-admin/Tasks';

import GovernmentOverview from '@/components/dashboard/roles/government/Overview';
import GovernmentActivity from '@/components/dashboard/roles/government/Activity';
import GovernmentTasks from '@/components/dashboard/roles/government/Tasks';

import FundingPartnerOverview from '@/components/dashboard/roles/funding-partner/Overview';
import FundingPartnerActivity from '@/components/dashboard/roles/funding-partner/Activity';
import FundingPartnerTasks from '@/components/dashboard/roles/funding-partner/Tasks';

type Role =
  | 'STUDENT'
  | 'FELLOW'
  | 'PROGRAM_MANAGER'
  | 'ZONAL_MANAGER'
  | 'SUPER_ADMIN'
  | 'GOVERNMENT'
  | 'FUNDING_PARTNER';

export default function RoleDashboard({
  role,
  programmeType,
  userId,
}: {
  role: string;
  programmeType?: string | null;
  userId?: string;
}) {
  const id = userId ?? '';

  const dispatchers: Record<Role, React.ReactNode> = {
    STUDENT: (
      <DashboardTabs
        overview={<StudentOverview userId={id} />}
        activity={<StudentActivity userId={id} />}
        tasks={<StudentTasks userId={id} />}
      />
    ),
    FELLOW: (
      <DashboardTabs
        overview={<FellowOverview userId={id} />}
        activity={<FellowActivity userId={id} />}
        tasks={<FellowTasks userId={id} />}
      />
    ),
    PROGRAM_MANAGER: (
      <DashboardTabs
        overview={<PMOverview userId={id} />}
        activity={<PMActivity userId={id} />}
        tasks={<PMTasks userId={id} />}
      />
    ),
    ZONAL_MANAGER: (
      <DashboardTabs
        overview={<ZMOverview userId={id} />}
        activity={<ZMActivity userId={id} />}
        tasks={<ZMTasks userId={id} />}
      />
    ),
    SUPER_ADMIN: (
      <DashboardTabs
        overview={<SuperAdminOverview userId={id} />}
        activity={<SuperAdminActivity userId={id} />}
        tasks={<SuperAdminTasks userId={id} />}
      />
    ),
    GOVERNMENT: (
      <DashboardTabs
        overview={<GovernmentOverview userId={id} />}
        activity={<GovernmentActivity userId={id} />}
        tasks={<GovernmentTasks />}
      />
    ),
    FUNDING_PARTNER: (
      <DashboardTabs
        overview={<FundingPartnerOverview userId={id} />}
        activity={<FundingPartnerActivity userId={id} />}
        tasks={<FundingPartnerTasks />}
      />
    ),
  };

  const node = dispatchers[role as Role];
  if (!node) return <EmptyState helperText="No dashboard for this role" />;

  void programmeType;
  return <>{node}</>;
}
