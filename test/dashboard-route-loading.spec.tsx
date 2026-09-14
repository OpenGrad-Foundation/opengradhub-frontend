import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ loading: true, allowed: true, replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/tracker',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: state.replace }),
}));
vi.mock('@/hooks/use-permission', () => ({
  usePermissions: () => ({ isLoading: state.loading, has: () => state.allowed }),
}));
import { DashboardRouteGuard } from '@/components/require-permission';

beforeEach(() => { state.loading = true; state.allowed = true; state.replace.mockReset(); });
afterEach(cleanup);

describe('dashboard route loading', () => {
  it('shows progress while the profile is pending, then reveals authorized content', () => {
    const view = render(<DashboardRouteGuard><p>Private dashboard</p></DashboardRouteGuard>);
    expect(screen.getByRole('status').textContent).toContain('Opening your dashboard');
    expect(screen.queryByText('Private dashboard')).toBeNull();
    expect(state.replace).not.toHaveBeenCalled();
    state.loading = false;
    view.rerender(<DashboardRouteGuard><p>Private dashboard</p></DashboardRouteGuard>);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Private dashboard')).toBeTruthy();
  });

  it('waits for permissions before denying access and redirecting', () => {
    state.allowed = false;
    const view = render(<DashboardRouteGuard><p>Private dashboard</p></DashboardRouteGuard>);
    expect(screen.queryByText('No access')).toBeNull();
    expect(state.replace).not.toHaveBeenCalled();
    state.loading = false;
    view.rerender(<DashboardRouteGuard><p>Private dashboard</p></DashboardRouteGuard>);
    expect(screen.getByText('No access')).toBeTruthy();
    expect(screen.queryByText('Private dashboard')).toBeNull();
    expect(state.replace).toHaveBeenCalledWith('/dashboard');
  });
});
