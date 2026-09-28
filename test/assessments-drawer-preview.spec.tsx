import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ permissions: ['scope.subtree', 'assessments.view', 'analytics.view', 'students.view'], getQuizById: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/dashboard/assessments', useSearchParams: () => new URLSearchParams('drawer=q1') }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'staff' }, role: { code: 'ZONAL_MANAGER' }, permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/api', async original => ({ ...(await original<typeof import('../lib/api')>()), getQuizById: state.getQuizById, getQuizLeaderboard: async () => ({ rankings: [] }) }));
vi.mock('../lib/queries/assessments', () => ({ useAssessmentsOverview: () => ({ data: { items: [], total: 0 } }) }));
vi.mock('../lib/queries/batches', () => ({ useBatches: () => ({ data: [] }) }));
vi.mock('../lib/queries/programmes', () => ({ useProgrammes: () => ({ data: [] }) }));
vi.mock('../components/quiz-student-preview', () => ({ QuizStudentPreview: ({ quiz }: { quiz: { title: string } }) => <div>Student preview of {quiz.title}</div> }));
import AssessmentsPage from '../app/dashboard/assessments/page';
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('offers a read-only Preview in the quiz drawer to viewers who cannot edit', async () => {
  state.getQuizById.mockResolvedValue({ id: 'q1', title: 'Algebra check' });
  render(<AssessmentsPage />);
  expect(screen.queryByRole('button', { name: /Edit in Builder/ })).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: 'Preview' }));
  expect(await screen.findByText('Student preview of Algebra check')).toBeTruthy();
  expect(state.getQuizById).toHaveBeenCalledWith('q1');
});
