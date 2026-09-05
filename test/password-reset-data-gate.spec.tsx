import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ permissions: ['password_resets.view', 'password_resets.manage'], list: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/password-resets', useSearchParams: () => new URLSearchParams('from=%2Fdashboard%2Fprogrammes%2Fp1') }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/api', () => ({ getPasswordResetRequests: state.list, approvePasswordResetRequest: vi.fn(), rejectPasswordResetRequest: vi.fn() }));
import PasswordResetsPage from '../app/dashboard/password-resets/page';
const request = { id: 'r1', user_id: 's1', student_name: 'Scoped learner', roll_number: '001', created_at: '2026-09-05' };
afterEach(() => { cleanup(); vi.clearAllMocks(); state.permissions = ['password_resets.view', 'password_resets.manage']; });
it('does not fetch identities with reset permissions alone', () => {
  state.list.mockResolvedValue([request]);
  render(<PasswordResetsPage />);
  expect(state.list).not.toHaveBeenCalled();
  expect(screen.queryByText(/Scoped learner/)).toBeNull();
});
it('links a visible learner only when the full-profile permission is granted', async () => {
  state.permissions.push('students.view', 'reports.view');
  state.list.mockResolvedValue([request]);
  render(<PasswordResetsPage />);
  const link = await screen.findByRole('link', { name: 'Scoped learner' });
  expect(link.getAttribute('href')).toContain('/dashboard/students/s1?from=');
});
it('keeps a readable request as plain text without a profile capability and hides it on revoke', async () => {
  state.permissions.push('students.view');
  state.list.mockResolvedValue([request]);
  const rendered = render(<PasswordResetsPage />);
  expect(await screen.findByText(/Scoped learner/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Scoped learner' })).toBeNull();
  state.permissions = ['password_resets.view', 'password_resets.manage'];
  rendered.rerender(<PasswordResetsPage />);
  await waitFor(() => expect(screen.queryByText(/Scoped learner/)).toBeNull());
});
