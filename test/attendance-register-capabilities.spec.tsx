import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ permissions: ['attendance.view', 'attendance.manage', 'schools.view'], gaps: vi.fn(), register: vi.fn() }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/queries/attendance', () => ({
  useRegisterGaps: (...args: unknown[]) => { state.gaps(...args); return { data: { due_month: '2026-08', schools: [], total: 0 } }; },
  useSchoolRegister: (...args: unknown[]) => { state.register(...args); return {}; },
}));
import RegisterGaps from '../components/dashboard/RegisterGaps';
import { AttendancePanel } from '../app/dashboard/schools/[id]/AttendancePanel';
afterEach(() => { cleanup(); vi.clearAllMocks(); state.permissions = ['attendance.view', 'attendance.manage', 'schools.view']; });
it('does not query or display the dashboard register widget without student visibility', () => {
  const { container } = render(<RegisterGaps />);
  expect(state.gaps).toHaveBeenCalledWith(false);
  expect(container.textContent).toBe('');
});
it('does not offer the school register panel with attendance permission alone', () => {
  render(<AttendancePanel schoolId="s1" canView />);
  expect(screen.queryByRole('button', { name: /Attendance/ })).toBeNull();
  expect(state.register).toHaveBeenCalledWith('s1', null, false);
});
it('allows the register widget for a custom role holding the full workflow capabilities', () => {
  state.permissions.push('students.view');
  render(<RegisterGaps />);
  expect(state.gaps).toHaveBeenCalledWith(true);
  expect(screen.getByText('Registers · August 2026')).toBeTruthy();
});
