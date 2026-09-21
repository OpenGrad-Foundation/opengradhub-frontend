import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PMOverview from '@/components/dashboard/roles/program-manager/Overview';

let permissions: string[] = [];
let failed = false;
const registerQuery = vi.fn();
const reportQuery = vi.fn();
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({
  has: (code: string) => permissions.includes(code),
  hasAll: (...codes: string[]) => codes.every(code => permissions.includes(code)),
}) }));
vi.mock('@/lib/queries/dashboard/_insights-overview', () => ({ useInsightsOverview: () => ({
  widgets: { stats: [{ key: 'students', value: 248 }, { key: 'avg', value: 72 }], chart: { data: { labels: [], datasets: [] } } },
  isLoading: false, error: null, refetch: vi.fn(),
}) }));
vi.mock('@/lib/queries/attendance', () => ({ useRegisterGaps: (enabled: boolean) => {
  registerQuery(enabled);
  return { data: { total: 8, behind_total: 2 }, isLoading: false, error: failed ? new Error('Unavailable') : null, refetch: vi.fn() };
} }));
vi.mock('@/lib/queries/dashboard/use-reported-count', () => ({ useOpenReportedCount: (enabled: boolean) => {
  reportQuery(enabled);
  return { count: 3, isLoading: false, error: failed ? new Error('Unavailable') : null, refetch: vi.fn() };
} }));
vi.mock('@/components/dashboard/primitives/ChartCard', () => ({ default: () => <div>Enrolment chart</div> }));

beforeEach(() => { cleanup(); permissions = []; failed = false; vi.clearAllMocks(); });

describe('Program Manager overview actions', () => {
  it('hides denied destinations and cached follow-up counts, then enables permitted tools', () => {
    const { rerender } = render(<PMOverview userId="pm" />);
    expect(registerQuery).toHaveBeenLastCalledWith(false);
    expect(reportQuery).toHaveBeenLastCalledWith(false);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    permissions = ['attendance.view', 'attendance.manage', 'students.view', 'schools.view', 'test_bank.manage_questions', 'test_bank.view', 'tracker.view'];
    rerender(<PMOverview userId="pm" />);
    expect(registerQuery).toHaveBeenLastCalledWith(true);
    expect(reportQuery).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('link', { name: /Registers missing/ }).getAttribute('href')).toBe('/dashboard?tab=follow-ups');
    expect(screen.getByRole('link', { name: /Task tracker/ }).getAttribute('href')).toBe('/dashboard/tracker');
    expect(screen.queryByRole('link', { name: /Programmes/ })).toBeNull();
    failed = true;
    rerender(<PMOverview userId="pm" />);
    expect(screen.getByText('Could not check registers.')).toBeTruthy();
    expect(screen.getByText('Could not check question reports.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Registers missing/ })).toBeNull();
  });
});
