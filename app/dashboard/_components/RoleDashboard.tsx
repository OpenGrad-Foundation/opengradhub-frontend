"use client";

import React from 'react';
import DashboardTabs from './DashboardTabs';
import EmptyState from '@/components/dashboard/primitives/EmptyState';
import UnreadAnnouncements from '@/components/dashboard/UnreadAnnouncements';

import StudentOverview from '@/components/dashboard/roles/student/Overview';
import StudentActivity from '@/components/dashboard/roles/student/Activity';

import FellowOverview from '@/components/dashboard/roles/fellow/Overview';
import FellowActivity from '@/components/dashboard/roles/fellow/Activity';

import PMOverview from '@/components/dashboard/roles/program-manager/Overview';
import PMActivity from '@/components/dashboard/roles/program-manager/Activity';

import ZMOverview from '@/components/dashboard/roles/zonal-manager/Overview';
import ZMActivity from '@/components/dashboard/roles/zonal-manager/Activity';

import SuperAdminOverview from '@/components/dashboard/roles/super-admin/Overview';
import SuperAdminActivity from '@/components/dashboard/roles/super-admin/Activity';

import GovernmentOverview from '@/components/dashboard/roles/government/Overview';
import GovernmentActivity from '@/components/dashboard/roles/government/Activity';

import FundingPartnerOverview from '@/components/dashboard/roles/funding-partner/Overview';
import FundingPartnerActivity from '@/components/dashboard/roles/funding-partner/Activity';

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

  // Prepend the unread-announcements widget to every role's Overview tab.
  const overview = (node: React.ReactNode) => (
    <div className="space-y-6">
      <UnreadAnnouncements role={role} />
      {node}
    </div>
  );

  const dispatchers: Record<Role, React.ReactNode> = {
    STUDENT: (
      <DashboardTabs
        overview={overview(<StudentOverview userId={id} />)}
        activity={<StudentActivity userId={id} />}
      />
    ),
    FELLOW: (
      <DashboardTabs
        overview={overview(<FellowOverview userId={id} />)}
        activity={<FellowActivity userId={id} />}
      />
    ),
    PROGRAM_MANAGER: (
      <DashboardTabs
        overview={overview(<PMOverview userId={id} />)}
        activity={<PMActivity userId={id} />}
      />
    ),
    ZONAL_MANAGER: (
      <DashboardTabs
        overview={overview(<ZMOverview userId={id} />)}
        activity={<ZMActivity userId={id} />}
      />
    ),
    SUPER_ADMIN: (
      <DashboardTabs
        overview={overview(<SuperAdminOverview userId={id} />)}
        activity={<SuperAdminActivity userId={id} />}
      />
    ),
    GOVERNMENT: (
      <DashboardTabs
        overview={overview(<GovernmentOverview userId={id} />)}
        activity={<GovernmentActivity userId={id} />}
      />
    ),
    FUNDING_PARTNER: (
      <DashboardTabs
        overview={overview(<FundingPartnerOverview userId={id} />)}
        activity={<FundingPartnerActivity userId={id} />}
      />
    ),
  };

  const node = dispatchers[role as Role];
  if (!node) return <EmptyState helperText="No dashboard for this role" />;

  void programmeType;
  return <>{node}</>;
}
