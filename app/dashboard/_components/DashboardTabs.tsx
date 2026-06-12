"use client";

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export type DashboardTab = 'overview' | 'activity';

type DashboardTabsProps = {
  overview: React.ReactNode;
  activity: React.ReactNode;
};

const TAB_ORDER: DashboardTab[] = ['overview', 'activity'];
const TAB_LABELS: Record<DashboardTab, string> = {
  overview: 'Overview',
  activity: 'Activity',
};

function parseTab(raw: string | null): DashboardTab {
  if (raw === 'activity') return raw;
  return 'overview';
}

export default function DashboardTabs({ overview, activity }: DashboardTabsProps) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const active = parseTab(params.get('tab'));

  const panels: Record<DashboardTab, React.ReactNode> = { overview, activity };

  return (
    <div>
      <div role="tablist" aria-label="Dashboard tabs" className="mb-4 flex gap-1 border-b border-slate-200">
        {TAB_ORDER.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => router.replace(`${pathname}?tab=${tab}`, { scroll: false })}
              className={
                'px-4 py-2 text-sm font-semibold border-b-2 transition-colors ' +
                (isActive
                  ? 'border-[var(--teal)] text-[var(--dark-teal)]'
                  : 'border-transparent text-slate-500 hover:text-[var(--dark-teal)]')
              }
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{panels[active]}</div>
    </div>
  );
}
