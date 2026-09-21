import { describe, it, expect } from 'vitest';
import { workspaceTitleFor } from '@/components/dashboard-shell';
import { PERM } from '@/lib/permissions';
import { TRACKER_NAME } from '@/lib/labels';

describe('workspaceTitleFor', () => {
  it('titles staff views and leaves learner views to their own heading', () => {
    expect(workspaceTitleFor('/dashboard/courses', ['courses.view'])).toBe('Courses');
    expect(workspaceTitleFor('/dashboard/courses', ['courses.view', PERM.scope.self])).toBeNull();
  });

  it('gates course management on edit permission', () => {
    expect(workspaceTitleFor('/dashboard/course-management/abc', ['courses.edit'])).toBe('Course');
    expect(workspaceTitleFor('/dashboard/course-management/abc', ['courses.view'])).toBeNull();
  });

  it('titles role-neutral pages for everyone and skips unknown routes', () => {
    expect(workspaceTitleFor('/dashboard/tracker', [])).toBe(TRACKER_NAME);
    expect(workspaceTitleFor('/dashboard/schools/123', ['schools.view'])).toBeNull();
  });
});
