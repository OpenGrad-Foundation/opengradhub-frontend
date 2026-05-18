import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequirePermission } from '../require-permission';

// Mock the permissions hook — tests control its return value per case.
const mockUsePermissions = vi.fn();
vi.mock('@/hooks/use-permission', () => ({
  usePermissions: () => mockUsePermissions(),
}));

// RequirePermission does not use navigation hooks, but require-permission.tsx
// also exports DashboardRouteGuard which does — the top-level module mock in
// test/setup.ts covers those.

describe('RequirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while permissions are still loading', () => {
    mockUsePermissions.mockReturnValue({ hasAny: vi.fn(), isLoading: true });

    const { container } = render(
      <RequirePermission perm="courses.view">
        <span>Protected content</span>
      </RequirePermission>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('renders children when the user has the required permission', () => {
    mockUsePermissions.mockReturnValue({
      hasAny: vi.fn().mockReturnValue(true),
      isLoading: false,
    });

    render(
      <RequirePermission perm="courses.view">
        <span>Protected content</span>
      </RequirePermission>,
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('renders NoAccess when the user lacks the permission', () => {
    mockUsePermissions.mockReturnValue({
      hasAny: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <RequirePermission perm="courses.view">
        <span>Protected content</span>
      </RequirePermission>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('renders a custom fallback instead of NoAccess when provided', () => {
    mockUsePermissions.mockReturnValue({
      hasAny: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <RequirePermission perm="courses.view" fallback={<span>Custom fallback</span>}>
        <span>Protected content</span>
      </RequirePermission>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('No access')).toBeNull();
  });

  it('accepts an array of permission codes and passes when ANY is held', () => {
    const hasAny = vi.fn().mockReturnValue(true);
    mockUsePermissions.mockReturnValue({ hasAny, isLoading: false });

    render(
      <RequirePermission perm={['courses.view', 'courses.create']}>
        <span>Multi-perm content</span>
      </RequirePermission>,
    );

    expect(screen.getByText('Multi-perm content')).toBeInTheDocument();
    expect(hasAny).toHaveBeenCalledWith('courses.view', 'courses.create');
  });

  it('denies access when none of the array permissions are held', () => {
    mockUsePermissions.mockReturnValue({
      hasAny: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <RequirePermission perm={['courses.view', 'courses.create']}>
        <span>Multi-perm content</span>
      </RequirePermission>,
    );

    expect(screen.queryByText('Multi-perm content')).toBeNull();
    expect(screen.getByText('No access')).toBeInTheDocument();
  });
});
