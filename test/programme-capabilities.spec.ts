import { describe, expect, it } from 'vitest';
import * as permissions from '../lib/permissions';

describe('programme capability boundaries', () => {
  const capabilities = (codes: string[], member = false) =>
    permissions.programmeCapabilities?.((code: string) => codes.includes(code), member);

  it('does not turn opening a programme or membership into student or staff data access', () => {
    expect(capabilities(['programmes.view'], true)).toEqual({
      create: false, manage: false, manageMembers: false, students: false, staffContacts: false,
    });
  });
  it('lets a custom unrestricted manager maintain settings without a membership or role shortcut', () => {
    expect(capabilities(['programmes.manage', 'scope.unrestricted'])).toMatchObject({ manage: true, manageMembers: false });
  });
  it('keeps member management independent from settings and data', () => {
    expect(capabilities(['programmes.manage_members'], true)).toMatchObject({ manage: false, manageMembers: true, students: false });
    expect(capabilities(['programmes.manage_members'])).toMatchObject({ manageMembers: false });
  });
  it('retires programmes.edit and gives create its own capability', () => {
    expect(capabilities(['programmes.edit'], true)).toMatchObject({ create: false, manage: false });
    expect(capabilities(['programmes.create'])).toMatchObject({ create: true, manage: false });
  });
  it('uses the student data permission for the profile route', () => {
    expect(permissions.ROUTE_PERMISSION.students).toBe('students.view');
  });
  it('lets create-only users browse duplication material without unlocking normal list routes', () => {
    expect(permissions.routePermissionForPath?.('/dashboard/courses/duplicate')).toBe('courses.create');
    expect(permissions.routePermissionForPath?.('/dashboard/test-bank/duplicate')).toBe('test_bank.create');
    expect(permissions.routePermissionForPath?.('/dashboard/courses')).toBe('courses.view');
    expect(permissions.routePermissionForPath?.('/dashboard/test-bank')).toBe('test_bank.view');
  });
  it('requires student access and a profile data permission for full profiles', () => {
    for (const grants of [['students.view'], ['analytics.view_admin'], ['reports.view']]) {
      expect(permissions.canAccessDashboardPath?.('/dashboard/students/s1', p => grants.includes(p))).toBe(false);
    }
    for (const grant of ['analytics.view', 'analytics.view_admin', 'analytics.view_manager', 'analytics.view_fellow', 'reports.view']) {
      expect(permissions.canAccessDashboardPath?.('/dashboard/students/s1', p => ['students.view', grant].includes(p))).toBe(true);
    }
  });
});
