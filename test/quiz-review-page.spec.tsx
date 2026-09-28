import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ review: vi.fn(), reports: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'quiz', attemptId: 'attempt' }),
  useRouter: () => ({ push: api.push }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/quiz/quiz/review/attempt',
}));
vi.mock('../hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { programme: 'UG' } } }) }));
vi.mock('../lib/api', () => ({ getAttemptReview: api.review, getMyQuestionReports: api.reports }));
vi.mock('../components/report-question-modal', () => ({
  ReportQuestionButton: ({ snapshotId }: { snapshotId: string }) => <button aria-label={`Report ${snapshotId}`}>Report question</button>,
}));
vi.mock('../app/dashboard/_components/MathContent', () => ({ MathContent: ({ html }: { html: string }) => <span>{html}</span> }));
import AttemptReviewPage from '../app/dashboard/quiz/[id]/review/[attemptId]/page';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('uses independent hidden-answer retries for standalone and grouped questions on the platform review route', async () => {
  const questions = ['single', 'child'].map((id, index) => ({
    snapshot_id: id, question_type: 'MCQ', content_html: `Prompt ${id}`,
    student_answer: `${id}-b`, is_correct: true,
    parent_snapshot_id: index ? 'group' : null,
    parent_content_html: index ? 'Shared reading passage' : null,
    options: [
      { id: `${id}-a`, option_text: `Choice A ${id}`, is_correct: false },
      { id: `${id}-b`, option_text: `Choice B ${id}`, is_correct: true },
    ],
    solution_html: `Solution ${id}`, batch_total_count: 10, batch_correct_count: 7,
  }));
  api.review.mockResolvedValue({ score: 2, max_score: 2, sections: [], questions });
  api.reports.mockResolvedValue([]);
  render(<AttemptReviewPage />);

  expect(await screen.findByText('Shared reading passage')).toBeTruthy();
  expect(api.review).toHaveBeenCalledWith('attempt');
  expect(screen.getByRole('button', { name: 'Report child' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'View answer' })).toHaveLength(2);
  expect(screen.queryByText('Solution single')).toBeNull();
  expect(screen.queryByText('Solution child')).toBeNull();
  expect(screen.queryAllByLabelText('Question statistics')).toHaveLength(0);

  const childCard = screen.getByText('Prompt child').closest('article')!;
  fireEvent.click(within(childCard).getByRole('radio', { name: 'Choice A child' }));
  fireEvent.click(within(childCard).getByRole('button', { name: 'View answer' }));
  expect(screen.getByText('Solution child')).toBeTruthy();
  expect(screen.queryByText('Solution single')).toBeNull();
  expect(screen.getByText('2/2')).toBeTruthy();
  expect(questions[1].student_answer).toBe('child-b');

  fireEvent.click(within(childCard).getByRole('button', { name: 'Hide answer' }));
  expect(within(childCard).getByRole('radio', { name: /Choice A child/ }).getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByText('Solution child')).toBeNull();
});
