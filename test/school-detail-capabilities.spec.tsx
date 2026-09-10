import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ grants: ['schools.view'], analytics: vi.fn(), roster: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'school' }), usePathname: () => '/dashboard/schools/school', useSearchParams: () => new URLSearchParams() }));
vi.mock('@/hooks/use-permission', () => ({
  usePermissions: () => ({ has: (code: string) => state.grants.includes(code) }),
  useAnyPermission: (...codes: string[]) => codes.some(code => state.grants.includes(code)),
}));
vi.mock('@/lib/mutations/invalidation', () => ({ useInvalidate: () => vi.fn() }));
vi.mock('@/lib/api', async original => ({
  ...(await original<typeof import('@/lib/api')>()),
  fetchSchoolRosterDetail: async () => { state.roster(); return ({
    school: { id: 'school', name: 'School name', fellow_name: 'Staff name', fellow_email: 'staff@example.test', zm_name: 'Zonal name', zm_email: 'zm@example.test' },
    stats: { student_count: 1, programmes: [] },
    students: [{ id: 's1', name: 'Student name', email: 'student@example.test' }],
    batches: [{ id: 'b1', name: 'Batch name', students: [] }],
  }); },
  getSchoolDetail: state.analytics,
}));
vi.mock('@/app/dashboard/schools/[id]/AttendancePanel', () => ({ AttendancePanel: () => null }));
import SchoolDetailPage from '@/app/dashboard/schools/[id]/page';

afterEach(() => { cleanup(); state.grants = ['schools.view']; vi.clearAllMocks(); });
describe('merged school detail data and destination gates', () => {
  it('does not fetch the full school roster or analytics without student identity access', async () => {
    render(<SchoolDetailPage />);
    await screen.findByText('Viewing school details requires permission to view students.');
    expect(state.roster).not.toHaveBeenCalled();
    expect(screen.queryByText('Student name')).toBeNull();
    expect(screen.queryByText('student@example.test')).toBeNull();
    expect(screen.queryByText('staff@example.test')).toBeNull();
    expect(screen.queryByText('zm@example.test')).toBeNull();
    expect(state.analytics).not.toHaveBeenCalled();
  });

  it('shows roster identity separately from learning profiles and student contacts', async () => {
    state.grants.push('students.view', 'staff.view_contacts');
    render(<SchoolDetailPage />);
    expect((await screen.findByText('Student name')).closest('a')).toBeNull();
    expect(screen.getByText('staff@example.test')).toBeTruthy();
    expect(screen.getByText('Zonal name')).toBeTruthy();
    expect(screen.getByText('zm@example.test')).toBeTruthy();
    expect(screen.queryByText('student@example.test')).toBeNull();
  });

  it('links permitted profiles and batches and applies the student contact grant independently', async () => {
    state.grants.push('students.view', 'students.view_contact', 'reports.view', 'batches.view');
    render(<SchoolDetailPage />);
    expect((await screen.findByRole('link', { name: 'Student name' })).getAttribute('href')).toBe('/dashboard/students/s1?from=%2Fdashboard%2Fschools%2Fschool');
    expect(screen.getByRole('link', { name: /Batch name/ })).toBeTruthy();
    expect(screen.getByText('student@example.test')).toBeTruthy();
    expect(screen.queryByText('staff@example.test')).toBeNull();
  });
});
