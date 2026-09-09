import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ permissions: ['scope.self', 'assessments.view', 'assessments.attempt', 'analytics.view'], available: vi.fn(), monitor: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/dashboard/assessments', useSearchParams: () => new URLSearchParams() }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'learner' }, role: { code: 'CUSTOM_LEARNER' }, permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/api', async original => ({ ...(await original<typeof import('../lib/api')>()), getAvailableQuizzes: state.available, getModuleQuizzes: async () => [], getMyQuizAttempts: async () => [], getTopicStrength: async () => [], getStudentEnrolments: async () => [] }));
vi.mock('../lib/queries/assessments', () => ({ useAssessmentsOverview: () => { state.monitor(); return { data: { items: [], total: 0 } }; } }));
vi.mock('../lib/queries/batches', () => ({ useBatches: () => ({ data: [] }) }));
vi.mock('../lib/queries/programmes', () => ({ useProgrammes: () => ({ data: [] }) }));
import AssessmentsPage from '../app/dashboard/assessments/page';
afterEach(() => { cleanup(); vi.clearAllMocks(); state.permissions = ['scope.self', 'assessments.view', 'assessments.attempt', 'analytics.view']; });
it('keeps a self-scope analytics holder on their own assigned quizzes', async () => {
  state.available.mockResolvedValue([]);
  render(<AssessmentsPage />);
  expect(await screen.findByText('No quizzes assigned to you yet')).toBeTruthy();
  expect(state.monitor).not.toHaveBeenCalled();
});
it('lets a self-scope viewer read assigned quizzes without offering an unauthorized attempt', async () => {
  state.permissions = ['scope.self', 'assessments.view'];
  state.available.mockResolvedValue([{ id: 'q1', title: 'Assigned quiz', max_attempts: 3 }]);
  render(<AssessmentsPage />);
  expect(await screen.findByText('Assigned quiz')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
});
it('does not fetch personal learning data for a staff scope carrying attempt permission', async () => {
  state.permissions = ['scope.subtree', 'assessments.view', 'assessments.attempt', 'analytics.view', 'students.view'];
  render(<AssessmentsPage />);
  await waitFor(() => expect(state.monitor).toHaveBeenCalled());
  expect(state.available).not.toHaveBeenCalled();
});

it('does not mount learner analytics without student visibility', () => {
  state.permissions = ['scope.subtree', 'assessments.view', 'analytics.view'];
  render(<AssessmentsPage />);
  expect(state.monitor).not.toHaveBeenCalled();
  expect(state.available).not.toHaveBeenCalled();
});
