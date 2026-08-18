import { describe, it, expect } from 'vitest';
import { withReportedStat } from '@/lib/queries/dashboard/_reported-stat';
import type { OverviewWidgets } from '@/lib/queries/dashboard/_shared';

const base: OverviewWidgets = {
  stats: [{ key: 'a', label: 'A', value: 1 }],
  chart: { title: 't', variant: 'bar', data: { labels: [], datasets: [] }, emptyHelper: '' },
};

describe('withReportedStat', () => {
  it('returns widgets unchanged when show is false', () => {
    const out = withReportedStat(base, { show: false, count: 4 });
    expect(out).toBe(base);
    expect(out.stats).toHaveLength(1);
  });

  it('appends a reported stat with an href when show is true', () => {
    const out = withReportedStat(base, { show: true, count: 4 });
    expect(out.stats).toHaveLength(2);
    const stat = out.stats[out.stats.length - 1];
    expect(stat).toMatchObject({
      key: 'reported',
      label: 'Reported Questions',
      value: 4,
      href: '/dashboard/test-bank?reports=open',
      tone: 'danger',
    });
    // Original object is not mutated.
    expect(base.stats).toHaveLength(1);
  });

  it('appends a zero-value stat with no danger tone when there are no open reports', () => {
    const out = withReportedStat(base, { show: true, count: 0 });
    const stat = out.stats[out.stats.length - 1];
    expect(stat.value).toBe(0);
    expect(stat.helper).toBe('None open');
    expect(stat.tone).toBeUndefined();
  });
});
