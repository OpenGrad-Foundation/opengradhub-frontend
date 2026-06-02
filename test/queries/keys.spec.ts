import { describe, it, expect } from 'vitest';
import { qk } from '../../lib/queries/keys';

describe('query-key factory', () => {
  it('builds a stable courses key including params', () => {
    expect(qk.courses({ programme: 'PG' })).toEqual(['og', 'courses', { programme: 'PG' }]);
  });

  it('builds a single-course key', () => {
    expect(qk.course('c1')).toEqual(['og', 'course', 'c1']);
  });

  it('builds a course-overview key scoped to the student', () => {
    expect(qk.courseOverview('c1', 's1')).toEqual(['og', 'course', 'c1', 'overview', 's1']);
  });

  it('builds a lesson key', () => {
    expect(qk.lesson('l1')).toEqual(['og', 'lesson', 'l1']);
  });

  it('builds a user key', () => {
    expect(qk.user('u1')).toEqual(['og', 'user', 'u1']);
  });

  it('builds an announcements key scoped to role', () => {
    expect(qk.announcements('STUDENT')).toEqual(['og', 'announcements', 'STUDENT']);
  });

  it('builds notification keys', () => {
    expect(qk.notifications('r1')).toEqual(['og', 'notifications', 'r1']);
    expect(qk.unreadCount('r1')).toEqual(['og', 'notifications', 'r1', 'unread']);
  });

  it('builds a student-courses key', () => {
    expect(qk.studentCourses('s1')).toEqual(['og', 'student', 's1', 'courses']);
  });

  it('exposes a root prefix for broad invalidation', () => {
    expect(qk.all).toEqual(['og']);
  });
});

describe('qk.dashboard', () => {
  it('returns a tuple prefixed with og/dashboard/<role>/<tab>', () => {
    expect(qk.dashboard('STUDENT', 'overview')).toEqual(['og', 'dashboard', 'STUDENT', 'overview']);
  });

  it('returns a widget-scoped key suitable for per-widget queries', () => {
    expect(qk.dashboardWidget('FELLOW', 'tasks', 'open-doubts'))
      .toEqual(['og', 'dashboard', 'FELLOW', 'tasks', 'open-doubts']);
  });
});
