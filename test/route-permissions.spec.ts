import { describe, expect, it } from 'vitest';
import { ROUTE_PERMISSION, PERM } from '../lib/permissions';

describe('dashboard route permissions', () => {
  it('does not allow student report access through the analytics route guard', () => {
    expect(ROUTE_PERMISSION.analytics).not.toContain('reports.view');
    expect(ROUTE_PERMISSION.analytics).not.toContain('analytics.view_student');
  });

  it('allows report-capable users through the reports route guard', () => {
    expect(ROUTE_PERMISSION.reports).toEqual(
      expect.arrayContaining([
        'reports.view',
        'analytics.view_fellow',
        'analytics.view_manager',
        'analytics.view_admin',
      ]),
    );
  });

  it('exposes the role_management.manage_roles permission and keeps the route gate on view', () => {
    expect(PERM.role_management.manage_roles).toBe('role_management.manage_roles');
    expect(ROUTE_PERMISSION['role-management']).toBe(PERM.role_management.view);
  });

  it('treats Tracker as a separate Hub module gated by tracker.view', () => {
    expect(PERM.tracker).toEqual({
      view: 'tracker.view',
      author: 'tracker.author',
      fill: 'tracker.fill',
      blocker_clear: 'tracker.blocker.clear',
      admin: 'tracker.admin',
    });
    expect(ROUTE_PERMISSION.tracker).toBe(PERM.tracker.view);
  });
});
