import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { canAccessDashboardPath } from '../lib/permissions';
const state = vi.hoisted(() => ({ permissions: ['student_export.view', 'students.view'], role: 'FELLOW' }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'one' }, role: { code: state.role }, permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/api', () => ({ getAnalyticsSchools: async () => [{ id: 's1', name: 'School one' }, { id: 's2', name: 'School two' }], getAnalyticsStudents: async () => [], downloadAnalyticsStudentsCsv: vi.fn() }));
import StudentExportPage from '../app/dashboard/student-export/page';
afterEach(() => { cleanup(); state.permissions = ['student_export.view', 'students.view']; });
it('requires student identity permission in addition to export viewing', () => {
  expect(canAccessDashboardPath('/dashboard/student-export', p => p === 'student_export.view')).toBe(false);
});
it('keeps scoped school choices editable without imposing the actor role label', async () => {
  render(<StudentExportPage />);
  const school = (await screen.findByRole('option', { name: 'School two' })).parentElement as HTMLSelectElement;
  expect(school.disabled).toBe(false);
  expect(school.value).toBe('');
});
it('offers CSV generation only with its separate action permission', async () => {
  render(<StudentExportPage />);
  await screen.findByText('Student Export');
  expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull();
});
