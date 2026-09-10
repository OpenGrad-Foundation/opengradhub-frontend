import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  grants: [] as string[], member: true, params: '', replace: vi.fn(), students: vi.fn(),
  addStudents: vi.fn(), eligible: [] as unknown[],
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'p1' }), usePathname: () => '/dashboard/programmes/p1',
  useSearchParams: () => new URLSearchParams(state.params),
  useRouter: () => ({ push: vi.fn(), replace: state.replace }),
}));
vi.mock('../hooks/use-permission', () => ({
  usePermissions: () => ({ has: (p: string) => state.grants.includes(p), isSuperAdmin: false }),
  usePermission: (p: string) => state.grants.includes(p),
  useAnyPermission: (...p: string[]) => p.some(x => state.grants.includes(x)),
}));
vi.mock('../lib/queries/current-user', () => ({ useCurrentUser: () => ({ data: { role: { code: 'CUSTOM' } } }) }));
vi.mock('../lib/queries/programmes', () => ({
  useProgramme: () => ({ data: { id: 'p1', name: 'Programme one', code: 'P1', status: 'ACTIVE', is_member: state.member } }),
  useProgrammeMembers: () => ({ data: [{ user_id: 'f1', name: 'Staff one', email: 'private@example.test', role: 'CUSTOM', source: 'MEMBER', via_schools: [] }] }),
  useProgrammeStudents: (...args: unknown[]) => { state.students(...args); return { data: { rows: [], total: 0 } }; },
  useProgrammeSchools: () => ({ data: [] }), useProgrammeBatches: () => ({ data: [] }),
  useProgrammeContent: () => ({ data: [{ id: 'q1', title: 'Quiz one', kind: 'quizzes' }, { id: 'r1', title: 'Resource one', kind: 'resources' }] }),
  useProgrammeOverview: () => ({ data: { reachable_students: 0, assigned_students: 0, schools: 0, batches: 0, staff: 0, content: { courses: 0, assignments: 0, resources: 0, quizzes: 0 }, activity: { attempts: 0, avg_score: null, attendance_marks: 0, tracker_records: 0 } } }),
  useAssignableBatches: () => ({ data: [] }), useAssignableContent: () => ({ data: [] }), useEligibleProgrammeMembers: () => ({ data: [] }),
  useEligibleProgrammeStudents: () => ({ data: { rows: state.eligible, total: state.eligible.length } }),
}));
vi.mock('../lib/mutations/programmes', () => Object.fromEntries([
  'useAssignProgrammeContent', 'useAttachProgrammeBatch', 'useAttachProgrammeSchool', 'useDetachProgrammeBatch', 'useDetachProgrammeSchool', 'useReleaseProgrammeContent', 'useAddProgrammeMember', 'useRemoveProgrammeMember', 'useUpdateProgramme',
].map(name => [name, () => ({ mutateAsync: vi.fn() })]).concat([
  ['useAddProgrammeStudents', () => ({ mutateAsync: state.addStudents, isPending: false })],
])));

import ProgrammeDetailPage from '../app/dashboard/programmes/[id]/page';
afterEach(() => { cleanup(); state.grants = []; state.member = true; state.params = ''; state.replace.mockReset(); state.students.mockReset(); state.addStudents.mockReset(); state.eligible = []; });

describe('rendered programme access and navigation', () => {
  it('never requests student identities from a view-only deep link', () => {
    state.params = 'tab=students'; state.grants = ['programmes.view'];
    render(<ProgrammeDetailPage />);
    expect(screen.queryByRole('tab', { name: 'Students' })).toBeNull();
    expect(state.students).not.toHaveBeenCalled();
  });
  it('restores the authorised roster query without resetting its page', () => {
    state.params = 'tab=students&q=Priya&school=s1&via=BATCH&page=2'; state.grants = ['programmes.view', 'students.view'];
    render(<ProgrammeDetailPage />);
    expect(state.students).toHaveBeenCalledWith('p1', true, expect.objectContaining({ q: 'Priya', school_id: 's1', via: 'BATCH', offset: 400 }));
  });
  it('offers settings to an unrestricted custom manager without a membership', () => {
    state.params = 'tab=settings'; state.member = false; state.grants = ['programmes.view', 'programmes.manage', 'scope.unrestricted'];
    render(<ProgrammeDetailPage />);
    expect(screen.getByRole('button', { name: /Archive programme/i })).toBeTruthy();
  });
  it('does not show contact fields without staff contact permission', () => {
    state.params = 'tab=people'; state.grants = ['programmes.view'];
    render(<ProgrammeDetailPage />);
    expect(screen.getByText('Staff one')).toBeTruthy();
    expect(screen.queryByText('private@example.test')).toBeNull();
  });
  it('writes the selected tab while preserving the roster return context', () => {
    state.params = 'tab=students&q=Priya&page=2'; state.grants = ['programmes.view', 'students.view'];
    render(<ProgrammeDetailPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'People' }));
    expect(state.replace).toHaveBeenCalledWith('/dashboard/programmes/p1?tab=people&q=Priya&page=2', { scroll: false });
  });
  it('connects quiz and resource rows only with the destination permission', () => {
    state.params = 'tab=content'; state.grants = ['programmes.view', 'test_bank.view', 'resources.view'];
    render(<ProgrammeDetailPage />);
    expect(screen.getByRole('link', { name: 'Quiz one' }).getAttribute('href')).toContain('/dashboard/quiz-builder/q1');
    expect(screen.getByRole('link', { name: 'Resource one' }).getAttribute('href')).toContain('/dashboard/resources?focus=r1');
  });

  it('hides Add students unless the caller administers the programme AND may edit users', () => {
    state.params = 'tab=students';
    // Student view alone: the roster renders, the write control does not.
    state.grants = ['programmes.view', 'students.view'];
    render(<ProgrammeDetailPage />);
    expect(screen.queryByText('Add students')).toBeNull();
    cleanup();
    // Programme administration without user_management.edit is still not enough.
    state.grants = ['programmes.view', 'students.view', 'programmes.manage'];
    render(<ProgrammeDetailPage />);
    expect(screen.queryByText('Add students')).toBeNull();
    cleanup();
    state.grants = ['programmes.view', 'students.view', 'programmes.manage', 'user_management.edit'];
    render(<ProgrammeDetailPage />);
    expect(screen.getByText('Add students')).toBeTruthy();
  });

  it('assigns the picked students and reports each refusal by name', async () => {
    state.params = 'tab=students';
    state.grants = ['programmes.view', 'students.view', 'programmes.manage', 'user_management.edit'];
    state.eligible = [
      { user_id: 's1', name: 'Priya R', roll_number: 'R-1', school_name: 'GHSS Nilambur', programme_type: 'UG', reached: true },
      { user_id: 's2', name: 'Arun K', roll_number: 'R-2', school_name: null, programme_type: 'PG', reached: false },
    ];
    state.addStudents.mockResolvedValue({ assigned: 1, failed: [{ user_id: 's2', name: 'Arun K', reason: 'Programme type PG does not match UG.' }] });
    render(<ProgrammeDetailPage />);
    fireEvent.click(screen.getByText('Add students'));
    fireEvent.focus(screen.getByPlaceholderText(/Search unassigned students/));
    fireEvent.click(screen.getByText('Select all 2'));
    fireEvent.click(screen.getByText('Add 2'));
    await screen.findByText(/1 student added/);
    expect(state.addStudents).toHaveBeenCalledWith({ id: 'p1', userIds: ['s1', 's2'] });
    expect(screen.getByText(/Arun K — Programme type/)).toBeTruthy();
    expect(screen.getByText(/does not match UG/)).toBeTruthy();
  });
});
