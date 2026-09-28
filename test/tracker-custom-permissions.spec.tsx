import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const state = vi.hoisted(() => ({ permissions: ['scope.subtree', 'tracker.view', 'tracker.author', 'students.view'], directZm: false }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'caller' }, role: { code: 'CUSTOM_STAFF' }, permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/api', () => ({ getStudentRoster: async () => ({ items: [{ id: 's1', name: 'Schoolless student', programme_type: 'CAT' }], total: 1, has_more: false }) }));
vi.mock('../lib/queries/tracker', () => ({
  ...Object.fromEntries(['useTrackerPms', 'useTrackerPmZms', 'useTrackerZmFellows', 'useTrackerFellows', 'useTrackerFellowSchools', 'useTrackerSchoolStudents', 'useTrackerZms'].map(name => [name, () => ({ data: [] })])),
  useTrackerTaskBreakdown: (_id: string, level: string) => ({ data: { rows: [level === 'fellow'
    ? { id: 'f1', name: 'In-charge row', done: 1, total: 1, rolled_state: 'done' }
    : { id: 's1', name: level === 'student' ? 'Student task record' : 'Scoped group', done: 1, total: 1, rolled_state: 'done', direct: level === 'zm' && state.directZm }], total: 1 } }),
}));
vi.mock('../app/dashboard/tracker/_components/student-details-form', () => ({ StudentDetailsForm: ({ readOnly }: { readOnly: boolean }) => <p>{readOnly ? 'Read only details' : 'Editable details'}</p> }));
import { HierarchicalStudentsPanel } from '../app/dashboard/tracker/_components/hierarchical-students';
import { TaskBreakdown } from '../app/dashboard/tracker/_components/task-breakdown';
import { allTasksFilterSpec } from '../app/dashboard/tracker/_components/filter-specs';
afterEach(() => { cleanup(); state.permissions = ['scope.subtree', 'tracker.view', 'tracker.author', 'students.view']; state.directZm = false; });
it('shows reachable schoolless students for custom staff and preserves the separate fill permission', async () => {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HierarchicalStudentsPanel /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: /Schoolless student/ }));
  expect(screen.getByText('Read only details')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Bulk Upload' })).toBeNull();
});
it('offers bulk upload to custom staff with fill permission', async () => {
  state.permissions.push('tracker.fill');
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HierarchicalStudentsPanel /></QueryClientProvider>);
  expect(await screen.findByRole('button', { name: 'Bulk Upload' })).toBeTruthy();
});
it('does not mount the roster without students.view', () => {
  state.permissions = ['scope.subtree', 'tracker.view', 'tracker.author'];
  render(<HierarchicalStudentsPanel />);
  expect(screen.getByText(/permission to view students/)).toBeTruthy();
});
it('lists a task by zonal manager, with no group-by switch', () => {
  render(<TaskBreakdown task={{ template_id: 't1', target_type: 'student', name: 'One task', done: 1, total: 1 } as never} currentUserId="caller" role="PROGRAM_MANAGER" canNudge={false} onBack={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Zonal Managers' })).toBeTruthy();
  expect(screen.queryByRole('combobox', { name: 'Group task records by' })).toBeNull();
});
it('expands a ZM in place to its in-charges, which open their task grid; a self-filling ZM opens directly', () => {
  const onOpenTask = vi.fn();
  render(<TaskBreakdown task={{ template_id: 't1', target_type: 'student', name: 'One task' } as never} currentUserId="caller" role="PROGRAM_MANAGER" canNudge={false} onBack={() => {}} onOpenTask={onOpenTask} />);
  const zm = screen.getByRole('button', { name: /Scoped group/ });
  expect(screen.queryByText('In-charge row')).toBeNull();
  fireEvent.click(zm);
  expect(zm.getAttribute('aria-expanded')).toBe('true');
  expect(onOpenTask).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /In-charge row/ }));
  expect(onOpenTask).toHaveBeenCalledWith('t1', 'f1', 'In-charge row');
  fireEvent.click(zm);
  expect(screen.queryByText('In-charge row')).toBeNull();
  cleanup(); onOpenTask.mockClear(); state.directZm = true;
  render(<TaskBreakdown task={{ template_id: 't1', target_type: 'fellow', name: 'ZM task' } as never} currentUserId="caller" role="PROGRAM_MANAGER" canNudge={false} onBack={() => {}} onOpenTask={onOpenTask} />);
  fireEvent.click(screen.getByRole('button', { name: /Scoped group/ }));
  expect(onOpenTask).toHaveBeenCalledWith('t1', 's1', 'Scoped group');
});
it('keeps a ZM filter available when the scoped facets contain multiple managers regardless of label', () => {
  const spec = allTasksFilterSpec({ states: [], zones: [], schools: [], incharges: [], zms: [{ value: 'z1', label: 'One' }, { value: 'z2', label: 'Two' }] });
  const zm = spec.find(item => item.key === 'zm')!;
  expect(zm.visibleFor?.({ role: 'ZONAL_MANAGER' }) ?? true).toBe(true);
});
