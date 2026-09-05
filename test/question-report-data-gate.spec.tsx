import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const state = vi.hoisted(() => ({ permissions: ['test_bank.manage_questions'], list: vi.fn(), count: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/test-bank', useSearchParams: () => new URLSearchParams('question=q1') }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/mutations/invalidation', () => ({ useInvalidate: () => vi.fn() }));
vi.mock('../lib/api', () => ({ getQuestionReports: state.list, getOpenReportedCount: state.count, resolveQuestionReport: vi.fn(), REPORT_CATEGORY_LABELS: {} }));
import { QuestionReportsPanel } from '../app/dashboard/_components/QuestionReportsPanel';
import { useOpenReportedCount } from '../lib/queries/dashboard/use-reported-count';
function Count() { const { count } = useOpenReportedCount(true); return <p>{count} reports</p>; }
afterEach(() => { cleanup(); vi.clearAllMocks(); state.permissions = ['test_bank.manage_questions']; });
it('does not request student reports from question material access alone', async () => {
  state.list.mockResolvedValue([{ id: 'r1', student_name: 'Private learner', status: 'OPEN', category: 'OTHER', created_at: '2026-09-05', quiz_title: 'Quiz' }]);
  render(<QuestionReportsPanel questionId="q1" />);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(state.list).not.toHaveBeenCalled();
  expect(screen.queryByText(/Private learner/)).toBeNull();
});
it('allows the scoped report response with both action and identity permissions', async () => {
  state.permissions.push('students.view');
  state.list.mockResolvedValue([{ id: 'r1', student_name: 'Visible learner', status: 'OPEN', category: 'OTHER', created_at: '2026-09-05', quiz_title: 'Quiz' }]);
  render(<QuestionReportsPanel questionId="q1" />);
  expect(await screen.findByText(/Visible learner/)).toBeTruthy();
});
it('does not request report counts when student data permission is missing', async () => {
  state.count.mockResolvedValue(4);
  render(<QueryClientProvider client={new QueryClient()}><Count /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByText('0 reports')).toBeTruthy());
  expect(state.count).not.toHaveBeenCalled();
});

it('links a reported learner only with the shared profile capability', async () => {
  state.permissions.push('students.view', 'reports.view');
  state.list.mockResolvedValue([{ id: 'r1', student_id: 's1', student_name: 'Visible learner', status: 'OPEN', category: 'OTHER', created_at: '2026-09-05', quiz_title: 'Quiz' }]);
  render(<QuestionReportsPanel questionId="q1" />);
  const link = await screen.findByRole('link', { name: 'Visible learner' });
  expect(link.getAttribute('href')).toContain('/dashboard/students/s1?from=');
});
