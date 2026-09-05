import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const state = vi.hoisted(() => ({ permissions: ['scope.subtree', 'tracker.view', 'tracker.author', 'students.view'] }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'caller' }, role: { code: 'CUSTOM_STAFF' }, permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/api', () => ({ getStudentRoster: async () => ({ items: [{ id: 's1', name: 'Schoolless student', programme_type: 'CAT' }], total: 1, has_more: false }) }));
vi.mock('../lib/queries/tracker', () => ({
  ...Object.fromEntries(['useTrackerPms', 'useTrackerPmZms', 'useTrackerZmFellows', 'useTrackerFellows', 'useTrackerFellowSchools', 'useTrackerSchoolStudents', 'useTrackerZms'].map(name => [name, () => ({ data: [] })])),
  useTrackerTaskBreakdown: (_id: string, level: string) => ({ data: { rows: [{ id: 's1', name: level === 'student' ? 'Student task record' : 'Scoped group', done: 1, total: 1, rolled_state: 'done' }], total: 1 } }),
}));
vi.mock('../app/dashboard/tracker/_components/student-details-form', () => ({ StudentDetailsForm: ({ readOnly }: { readOnly: boolean }) => <p>{readOnly ? 'Read only details' : 'Editable details'}</p> }));
import { HierarchicalStudentsPanel } from '../app/dashboard/tracker/_components/hierarchical-students';
import { TaskBreakdown } from '../app/dashboard/tracker/_components/task-breakdown';
import { allTasksFilterSpec } from '../app/dashboard/tracker/_components/filter-specs';
afterEach(() => { cleanup(); state.permissions = ['scope.subtree', 'tracker.view', 'tracker.author', 'students.view']; });
it('shows reachable schoolless students for custom staff and preserves the separate fill permission', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HierarchicalStudentsPanel /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: /Schoolless student/ }));
  expect(screen.getByText('Read only details')).toBeTruthy();
});
it('does not mount the roster without students.view', () => {
  state.permissions = ['scope.subtree', 'tracker.view', 'tracker.author'];
  render(<HierarchicalStudentsPanel />);
  expect(screen.getByText(/permission to view students/)).toBeTruthy();
});
it('starts a task at its target records independently of the actor role and offers scoped grouping', () => {
  render(<TaskBreakdown task={{ template_id: 't1', target_type: 'student', name: 'One task', done: 1, total: 1 } as never} currentUserId="caller" canNudge={false} onBack={() => {}} />);
  expect(screen.getByText('Student task record')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Group task records by' }), { target: { value: 'school' } });
  expect(screen.getByText('Scoped group')).toBeTruthy();
});
it('keeps a ZM filter available when the scoped facets contain multiple managers regardless of label', () => {
  const spec = allTasksFilterSpec({ states: [], zones: [], schools: [], incharges: [], zms: [{ value: 'z1', label: 'One' }, { value: 'z2', label: 'Two' }] });
  const zm = spec.find(item => item.key === 'zm')!;
  expect(zm.visibleFor?.({ role: 'ZONAL_MANAGER' }) ?? true).toBe(true);
});
