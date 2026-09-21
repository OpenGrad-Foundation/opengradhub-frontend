import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { qk } from '@/lib/queries/keys';
import PMOverview from '@/components/dashboard/roles/program-manager/Overview';
import WorkspaceHeader from '@/components/dashboard/WorkspaceHeader';
import PMDashboardHeader from '@/components/dashboard/roles/program-manager/Header';

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
vi.mock('@/lib/queries/dashboard/_doubts-activity', () => ({ useDoubtsActivity: () => ({
  items: Array.from({ length: 4 }, (_, index) => ({ kind: 'doubt', ts: `2026-09-${20 - index}T10:00:00Z`, text: `Student update ${index + 1}`, href: `/dashboard/doubts?focus=${index}` })),
  isLoading: false, error: null, refetch: vi.fn(),
}) }));
vi.mock('@/components/NotificationBell', () => ({ default: () => <button>Notifications</button> }));
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

it('refreshes the dashboard query families from the header control', async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
  render(<QueryClientProvider client={client}><PMDashboardHeader userId="pm" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh dashboard' }).hasAttribute('disabled')).toBe(false));
  expect(invalidate.mock.calls.map(([filter]) => filter?.queryKey)).toEqual([
    qk.dashboardWidget('PROGRAM_MANAGER', 'overview', 'pm'),
    qk.dashboardWidget('PROGRAM_MANAGER', 'activity', 'pm'),
    qk.attendanceGaps(),
    qk.openReportedCount(),
  ]);
});

it('shows only the three latest updates when the manager can read activity', () => {
  const { rerender } = render(<PMOverview userId="pm" />);
  expect(screen.queryByRole('heading', { name: 'Recent updates' })).toBeNull();
  permissions = ['doubts.view'];
  rerender(<PMOverview userId="pm" />);
  expect(screen.getAllByRole('link', { name: /Student update/ })).toHaveLength(3);
  expect(screen.queryByText('Student update 4')).toBeNull();
  expect(screen.getByRole('link', { name: /View all activity/ }).getAttribute('href')).toBe('/dashboard?tab=activity');
});

it('keeps the tab offset in sync with the header height and clears it on unmount', () => {
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {}
    disconnect = disconnect;
  });
  const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(80);
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><div data-dashboard-shell><PMDashboardHeader userId="pm" /></div></QueryClientProvider>);
  const shell = view.container.querySelector<HTMLElement>('[data-dashboard-shell]')!;
  expect(shell.style.getPropertyValue('--dashboard-header-height')).toBe('80px');
  height.mockReturnValue(116);
  resize();
  expect(shell.style.getPropertyValue('--dashboard-header-height')).toBe('116px');
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(shell.style.getPropertyValue('--dashboard-header-height')).toBe('');
  height.mockRestore();
  vi.unstubAllGlobals();
});

it.each(['Dashboard', 'Attendance'])('%s collapses on downward scroll, ignores small movements, and expands on upward scroll or click', (title) => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('scrollY', 0);
  let nextFrame: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { nextFrame = callback; return 1; });
  const scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  const matchMedia = vi.fn(() => ({ matches: false }));
  vi.stubGlobal('matchMedia', matchMedia);
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><div data-dashboard-shell>{title === 'Dashboard' ? <PMDashboardHeader userId="pm" /> : <WorkspaceHeader title={title} />}</div></QueryClientProvider>);
  const shell = view.container.querySelector('[data-dashboard-shell]')!;
  const scroll = (y: number) => {
    vi.stubGlobal('scrollY', y);
    fireEvent.scroll(window);
  };
  scroll(100);
  expect(shell.getAttribute('data-dashboard-compact')).toBe('true');
  expect(screen.queryByRole('heading', { name: title })).toBeNull();
  scroll(96);
  expect(shell.getAttribute('data-dashboard-compact')).toBe('true');
  scroll(80);
  expect(screen.getByRole('heading', { name: title })).toBeTruthy();
  scroll(150);
  fireEvent.click(screen.getByRole('button', { name: `Back to top of ${title.toLowerCase()}` }));
  expect(screen.getByRole('heading', { name: title })).toBeTruthy();
  expect(shell.hasAttribute('data-dashboard-compact')).toBe(false);
  expect(scrollTo).not.toHaveBeenCalled();
  nextFrame(0);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  matchMedia.mockReturnValue({ matches: true });
  scroll(180);
  fireEvent.click(screen.getByRole('button', { name: `Back to top of ${title.toLowerCase()}` }));
  nextFrame(0);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
  scroll(200);
  view.unmount();
  expect(shell.hasAttribute('data-dashboard-compact')).toBe(false);
  vi.unstubAllGlobals();
});
