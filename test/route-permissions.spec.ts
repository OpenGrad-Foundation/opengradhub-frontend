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

  it('gates the student profile route on the staff analytics permissions only', () => {
    expect(ROUTE_PERMISSION.students).toEqual(
      expect.arrayContaining([
        'analytics.view_admin',
        'analytics.view_manager',
        'analytics.view_fellow',
      ]),
    );
    // students hold analytics.view for their own dashboards — it must not open
    // another student's profile page.
    expect(ROUTE_PERMISSION.students).not.toContain('analytics.view');
  });

  it('treats Tracker as a separate Hub module gated by tracker.view', () => {
    expect(PERM.tracker).toEqual({
      view: 'tracker.view',
      author: 'tracker.author',
      // Sharing outside the organisation, split out of `author` in migration 124.
      // `author` includes Zonal Managers; publishing a task's proof photographs
      // and GPS coordinates to a funder is a different decision, so it needed a
      // permission of its own rather than riding on the one that writes tasks.
      share_external: 'tracker.share_external',
      fill: 'tracker.fill',
      fill_override: 'tracker.fill.override',
      blocker_clear: 'tracker.blocker.clear',
      admin: 'tracker.admin',
      // Added with school-visit geo verification (backend migration 097).
      geo_override: 'tracker.geo.override',
      // Added with deadline extensions (backend migration 098).
      extension_grant: 'tracker.extension.grant',
      // Added with the PBAC conversion of pm-view.guard (backend migration 111).
      // The All Tasks tab was gated on `roleCode === "PROGRAM_MANAGER" ||
      // "SUPER_ADMIN"`, mirroring a backend role check. Both now ask this
      // permission, so the screen cannot offer a surface the API refuses.
      all_tasks: 'tracker.all_tasks',
    });
    expect(ROUTE_PERMISSION.tracker).toBe(PERM.tracker.view);
  });
});
