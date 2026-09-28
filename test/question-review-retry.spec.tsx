import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QuestionReviewCard } from '../components/question-review-card';
import type { AttemptReviewQuestion } from '../lib/api';

vi.mock('../app/dashboard/_components/MathContent', () => ({ MathContent: ({ html }: { html: string }) => <span>{html}</span> }));
afterEach(cleanup);
const question = {
  snapshot_id: 'q1', question_type: 'MCQ', content_html: 'Which number is even?',
  student_answer: 'b', is_correct: true, options: [
    { id: 'a', option_text: 'Three', is_correct: false },
    { id: 'b', option_text: 'Four', is_correct: true },
  ], solution_html: 'Four is divisible by two.', explanation_video_url: 'https://youtu.be/abcdefghijk',
  batch_total_count: 10, batch_correct_count: 8,
} as AttemptReviewQuestion;

it('hides all answer clues until requested, allows a retry, and preserves the submitted answer', () => {
  const original = structuredClone(question);
  const { container } = render(<QuestionReviewCard q={question} idx={0} allowRetry />);
  expect(screen.queryByText('Correct')).toBeNull();
  expect(screen.queryByText(/Submitted answer/)).toBeNull();
  expect(screen.queryByText(question.solution_html!)).toBeNull();
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.querySelector('[data-result="correct"]')).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: /Three/ }));
  expect(screen.getByRole('radio', { name: /Three/ }).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'View answer' }));
  expect(screen.getByText('Correct answer')).toBeTruthy();
  expect(screen.getByText(question.solution_html!)).toBeTruthy();
  expect(container.querySelector('iframe')).toBeTruthy();
  expect(question).toEqual(original);
  fireEvent.click(screen.getByRole('button', { name: 'Hide answer' }));
  expect(screen.queryByText(question.solution_html!)).toBeNull();
  expect(screen.queryByText('Correct')).toBeNull();
  expect(screen.getByRole('radio', { name: /Three/ }).getAttribute('aria-checked')).toBe('true');
});

it('lets students retry written answers without exposing or replacing their submission', () => {
  render(<QuestionReviewCard q={{ ...question, question_type: 'NUMERICAL', student_answer: '42', correct_answer: '42', options: [], solution_html: null }} idx={0} allowRetry />);
  const input = screen.getByRole('spinbutton', { name: 'Try your answer' }) as HTMLInputElement;
  expect(input.value).toBe('');
  expect(screen.queryByText('42')).toBeNull();
  fireEvent.change(input, { target: { value: '18' } });
  fireEvent.click(screen.getByRole('button', { name: 'View answer' }));
  expect(screen.getByText('18')).toBeTruthy();
  expect(screen.getAllByText('42').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Hide answer' }));
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('18');
});

it('reveals only the selected question', () => {
  render(<><QuestionReviewCard q={question} idx={0} allowRetry /><QuestionReviewCard q={{ ...question, snapshot_id: 'q2', solution_html: 'Second solution' }} idx={1} allowRetry /></>);
  fireEvent.click(screen.getAllByRole('button', { name: 'View answer' })[0]);
  expect(screen.getByText(question.solution_html!)).toBeTruthy();
  expect(screen.queryByText('Second solution')).toBeNull();
});
