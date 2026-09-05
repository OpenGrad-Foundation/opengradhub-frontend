import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ role: 'CUSTOM_LEARNER', permissions: ['scope.self', 'courses.view', 'assignments.view', 'assignments.submit', 'assessments.view', 'assessments.attempt'], quiz: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'one' }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/courses/one', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: 'clerk-one' }) }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'learner' }, role: { code: state.role }, permissions: state.permissions }, isLoading: false }) }));
vi.mock('../lib/mutations/invalidation', () => ({ useInvalidate: () => vi.fn() }));
vi.mock('../lib/api', async original => ({
  ...(await original<typeof import('../lib/api')>()),
  getCourseById: async () => ({ id: 'one', title: 'Learning course', locking_mode: 'SEQUENTIAL', programme_type: 'UG' }),
  getCourseOverview: async () => [{ id: 'm1', title: 'Locked module', lessons: [{ id: 'l1', title: 'Locked lesson', order_index: 0, is_complete: false }], module_quizzes: [], is_locked: true }],
  getAssignmentById: async () => ({ id: 'one', title: 'Learning assignment', due_at: '2099-01-01', submission_type: 'LINK', submission_status: 'NOT_STARTED' }),
  getQuizById: state.quiz, getQuizAttempts: async () => [], getMyQuestionReports: async () => [],
}));
import CourseOverviewPage from '../app/dashboard/courses/[id]/page';
import AssignmentDetailPage from '../app/dashboard/assignments/[id]/page';
import QuizPage from '../app/dashboard/quiz/[id]/page';
afterEach(() => { cleanup(); state.role = 'CUSTOM_LEARNER'; state.permissions = ['scope.self', 'courses.view', 'assignments.view', 'assignments.submit', 'assessments.view', 'assessments.attempt']; vi.clearAllMocks(); });
describe('custom self-scope learning persona', () => {
  it('shows personal progress and retains sequential locks for a custom learner', async () => {
    render(<CourseOverviewPage />);
    await screen.findByText('Learning course');
    expect(screen.getByRole('link', { name: '← My Courses' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Locked lesson/ })).toBeNull();
  });
  it('shows assignment submission to a custom learner', async () => {
    render(<AssignmentDetailPage />);
    expect(await screen.findByRole('button', { name: 'Submit Assignment' })).toBeTruthy();
  });
  it('loads an authorized quiz for a custom learner', async () => {
    state.quiz.mockRejectedValue(new Error('Test stops after the authorized request'));
    render(<QuizPage />);
    await waitFor(() => expect(state.quiz).toHaveBeenCalledWith('one'));
    expect(screen.queryByText('Only students can take quizzes.')).toBeNull();
  });
  it('does not offer submission when a self-scope viewer lacks assignments.submit', async () => {
    state.permissions = ['scope.self', 'assignments.view'];
    render(<AssignmentDetailPage />);
    await screen.findByText('Learning assignment');
    expect(screen.queryByRole('button', { name: 'Submit Assignment' })).toBeNull();
  });
  it('does not offer a new quiz attempt without assessments.attempt', async () => {
    state.permissions = ['scope.self', 'assessments.view'];
    state.quiz.mockResolvedValue({ id: 'one', title: 'Read quiz', questions: [], time_limit_minutes: 10, max_attempts: 2 });
    render(<QuizPage />);
    await screen.findByText('Read quiz');
    expect(screen.queryByRole('button', { name: /Start Quiz/ })).toBeNull();
  });
  it('does not infer learner submission from a STUDENT label with a staff scope', async () => {
    state.role = 'STUDENT'; state.permissions = ['scope.subtree', 'assignments.view'];
    render(<AssignmentDetailPage />);
    await screen.findByText('Learning assignment');
    expect(screen.queryByRole('button', { name: 'Submit Assignment' })).toBeNull();
  });
});
