import { describe, it, expect } from 'vitest';
import { PERM, ROUTE_PERMISSION } from '../permissions';

describe('PERM constants', () => {
  it('has the correct format for all permission codes (<module>.<action>)', () => {
    const allCodes = Object.values(PERM).flatMap((module) => Object.values(module));
    for (const code of allCodes) {
      expect(code, `${code} should be <module>.<action>`).toMatch(/^\w+\.\w+$/);
    }
  });

  it('courses module has the expected actions', () => {
    expect(PERM.courses.view).toBe('courses.view');
    expect(PERM.courses.create).toBe('courses.create');
    expect(PERM.courses.enrol).toBe('courses.enrol');
  });

  it('user_management module has bulk_import', () => {
    expect(PERM.user_management.bulk_import).toBe('user_management.bulk_import');
  });
});

describe('ROUTE_PERMISSION map', () => {
  it('maps "courses" to courses.view', () => {
    expect(ROUTE_PERMISSION['courses']).toBe(PERM.courses.view);
  });

  it('maps "user-management" to user_management.view', () => {
    expect(ROUTE_PERMISSION['user-management']).toBe(PERM.user_management.view);
  });

  it('does not map the dashboard root (it is always accessible)', () => {
    expect(ROUTE_PERMISSION['dashboard']).toBeUndefined();
    expect(ROUTE_PERMISSION['']).toBeUndefined();
  });
});
