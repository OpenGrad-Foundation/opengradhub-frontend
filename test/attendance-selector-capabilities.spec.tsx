import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ permissions: ['attendance.view', 'students.view', 'batches.view'], courses: vi.fn(), batches: vi.fn(), query: '' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/dashboard/attendance', useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/queries/live-classes', () => ({ useLiveClasses: () => ({ data: [] }) }));
vi.mock('../lib/queries/attendance', () => ({ useAttendanceRecords: () => ({ data: undefined }), useStudentRecords: () => ({ data: undefined }) }));
vi.mock('../lib/queries/batches', () => ({ useBatches: (...args: unknown[]) => { state.batches(...args); return { data: [{ id: 'b1', name: 'Batch one' }] }; } }));
vi.mock('../lib/api', async original => ({ ...(await original<typeof import('../lib/api')>()), getCourses: state.courses }));
import { SchoolConfirmationsTab } from '../app/dashboard/attendance/_components/SchoolConfirmationsTab';
import { RecordsTab } from '../app/dashboard/attendance/_components/RecordsTab';
afterEach(() => { cleanup(); vi.clearAllMocks(); state.permissions = ['attendance.view', 'students.view', 'batches.view']; state.query = ''; });
it('does not fetch unauthorized course options for a batch-only reader', () => {
  state.courses.mockResolvedValue([]);
  render(<RecordsTab />);
  expect(state.courses).not.toHaveBeenCalled();
  expect((screen.getByRole('option', { name: 'By course' }) as HTMLOptionElement).disabled).toBe(true);
});
it('does not load or disclose cached batch choices to a course-only reader', () => {
  state.permissions = ['attendance.view', 'students.view', 'courses.view'];
  state.courses.mockResolvedValue([]);
  render(<RecordsTab />);
  expect(state.batches).toHaveBeenCalledWith(undefined, false);
  expect(screen.queryByRole('option', { name: 'Batch one' })).toBeNull();
});

it('does not request course or batch selectors for confirmations without those capabilities', () => {
  state.permissions = ['attendance.view', 'live_classes.view'];
  state.courses.mockResolvedValue([]);
  render(<SchoolConfirmationsTab canManage={false} />);
  expect(state.courses).not.toHaveBeenCalled();
  expect(state.batches).toHaveBeenCalledWith(undefined, false);
  expect(screen.queryByRole('option', { name: 'Batch one' })).toBeNull();
});
