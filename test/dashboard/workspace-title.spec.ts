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

  it('titles quiz builder routes and leaves duplicate alone', () => {
    expect(workspaceTitleFor('/dashboard/quiz-builder/abc', ['test_bank.edit'])).toBe('Quiz');
    expect(workspaceTitleFor('/dashboard/quiz-builder/abc', ['test_bank.view'])).toBeNull();
    expect(workspaceTitleFor('/dashboard/quiz-builder/new', [])).toBe('New quiz');
    expect(workspaceTitleFor('/dashboard/quiz-builder/duplicate', ['test_bank.edit'])).toBeNull();
  });

  it('titles every assignment route', () => {
    expect(workspaceTitleFor('/dashboard/assignments/new', [])).toBe('New assignment');
    expect(workspaceTitleFor('/dashboard/assignments/a1', [])).toBe('Assignment');
    expect(workspaceTitleFor('/dashboard/assignments/a1/edit', [])).toBe('Edit assignment');
    expect(workspaceTitleFor('/dashboard/assignments/a1/submissions', [])).toBe('Submissions');
  });
});
