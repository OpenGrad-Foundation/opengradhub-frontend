import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearDraft, loadDraft, saveDraft } from '../lib/quiz-draft';

const state = vi.hoisted(() => ({ sequential: false, router: { push: vi.fn() }, user: { permissions: ['scope.self', 'assessments.attempt'] } }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'quiz' }), useRouter: () => state.router, useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/quiz/quiz' }));
vi.mock('@clerk/nextjs', () => ({ useAuth: () => ({ userId: 'learner' }) }));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: state.user, isLoading: false }) }));
vi.mock('../lib/mutations/invalidation', () => ({ useInvalidate: () => () => {} }));
vi.mock('../app/dashboard/_components/MathContent', () => ({ MathContent: ({ html }: { html: string }) => <span>{html}</span> }));
vi.mock('../lib/api', async original => ({
  ...(await original<typeof import('../lib/api')>()),
  getQuizById: async () => ({ id: 'quiz', title: 'Practice exam', duration_minutes: 40, max_attempts: null, questions: [], sections: [], is_sectioned: state.sequential, sequential_sections: state.sequential }),
  getQuizAttempts: async () => [], getMyQuestionReports: async () => [],
  startQuizAttempt: async () => ({ attempt_id: 'cbt-attempt', attempt_number: 1, started_at: new Date().toISOString(), current_section_index: state.sequential ? 0 : null,
    sections: state.sequential ? [{ section_id: 's1', title: 'First section' }, { section_id: 's2', title: 'Second section' }] : [],
    questions: [1, 2, 3].map(n => ({ snapshot_id: `q${n}`, section_id: state.sequential ? 's1' : null, question_type: 'MCQ', content_html: `Question ${n}`, options: [{ id: `a${n}`, option_text: `Answer ${n}` }], children: [] })),
  }),
}));
import QuizTakingPage from '../app/dashboard/quiz/[id]/page';

beforeEach(async () => { state.sequential = false; await clearDraft('cbt-attempt'); });
afterEach(cleanup);

it('restores palette visits and answers from the draft and persists new visits', async () => {
  await saveDraft({ attempt_id: 'cbt-attempt', answers: { q1: 'a1' }, flagged: ['q1'], visited: ['q1', 'q2'], current_idx: 1, updated_at: Date.now() });
  render(<QuizTakingPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Start Quiz/ }));
  expect(await screen.findByRole('button', { name: 'Question 1: Answered & marked for review' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Question 2: Not answered' }).getAttribute('aria-current')).toBe('step');
  fireEvent.click(screen.getByRole('button', { name: 'Question 3: Not visited' }));
  await waitFor(async () => expect((await loadDraft('cbt-attempt'))?.visited).toEqual(['q1', 'q2', 'q3']), { timeout: 2000 });
  // Submission still requires the existing confirmation flow.
  fireEvent.click(screen.getAllByRole('button', { name: 'Submit Quiz' })[0]);
  expect(screen.getByText('Submit Quiz?')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Question 3: Not answered' })).toBeTruthy();
});

it('keeps sequential sections locked and marking the final question does not advance the section', async () => {
  state.sequential = true;
  render(<QuizTakingPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Start Quiz/ }));
  const locked = await screen.findByRole('button', { name: /Second section/ });
  expect((locked as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Question 3: Not visited' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark for Review & Next' }));
  expect(screen.getByRole('button', { name: 'Question 3: Marked for review' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Submit Section' }).length).toBe(2);
});
