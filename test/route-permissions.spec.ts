import { describe, expect, it } from 'vitest';
import { ROUTE_PERMISSION } from '../lib/permissions';

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
});
