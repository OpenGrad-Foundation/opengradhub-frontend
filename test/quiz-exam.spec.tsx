import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { QuizAttemptQuestion } from '../lib/api';
import { QuizExam } from '../components/quiz-exam';
import { QuizStudentPreview } from '../components/quiz-student-preview';
import type { Quiz } from '../lib/api';

// Math rendering loads KaTeX asynchronously; these tests exercise exam controls.
vi.mock('../app/dashboard/_components/MathContent', () => ({
  MathContent: ({ html }: { html: string }) => <span>{html}</span>,
}));
afterEach(cleanup);

const questions: QuizAttemptQuestion[] = [1, 2, 3].map(n => ({
  snapshot_id: `q${n}`, question_type: 'MCQ', content_html: `Question content ${n}`,
  tolerance: null, children: [], options: [{ id: `a${n}`, option_text: `Answer ${n}` }],
}));

function Exam({ items = questions }: { items?: QuizAttemptQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flagged, setFlagged] = useState(new Set<string>());
  const [visited, setVisited] = useState(new Set(['q1']));
  const navigate = (i: number) => { setIndex(i); setVisited(v => new Set(v).add(items[i].snapshot_id)); };
  return <QuizExam title="CAT practice" badge="Preview" timer="39:59" questions={items}
    currentIdx={index} answers={answers} flagged={flagged} visited={visited}
    onNavigate={navigate} onAnswer={(id, answer) => setAnswers(a => ({ ...a, [id]: answer }))}
    onToggleFlag={id => setFlagged(f => { const next = new Set(f); if (next.has(id)) next.delete(id); else next.add(id); return next; })}
    onMarkReview={id => setFlagged(f => new Set(f).add(id))}
    onNext={() => navigate(Math.min(items.length - 1, index + 1))}
    onSubmit={() => {}} submitLabel="Submit Quiz" />;
}

it('keeps answer and review status when navigating, and clearing only affects the current answer', () => {
  render(<Exam />);
  expect(screen.getByRole('button', { name: 'Question 2: Not visited' })).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Answer 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark for Review & Next' }));
  expect(screen.getByRole('button', { name: 'Question 1: Answered & marked for review' })).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Answer 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear Response' }));
  expect(screen.getByRole('radio', { name: 'Answer 2' }).getAttribute('aria-checked')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Question 1: Answered & marked for review' }));
  expect(screen.getByRole('radio', { name: 'Answer 1' }).getAttribute('aria-checked')).toBe('true');
});

it('marks the last question without submitting and keeps review toggling reversible', () => {
  render(<Exam />);
  fireEvent.click(screen.getByRole('button', { name: 'Question 3: Not visited' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark for Review & Next' }));
  expect(screen.getByRole('button', { name: 'Question 3: Marked for review' }).getAttribute('aria-current')).toBe('step');
  fireEvent.click(screen.getByRole('button', { name: 'Unmark review' }));
  expect(screen.getByRole('button', { name: 'Question 3: Not answered' })).toBeTruthy();
});

it('opens the compact palette, returns to the chosen question, and can dismiss with Escape', () => {
  render(<Exam />);
  const toggle = screen.getByRole('button', { name: 'Questions' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Question 3: Not visited' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByRole('heading', { name: 'Question 3 of 3' })).toBeTruthy();
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  fireEvent.keyDown(screen.getByRole('complementary', { name: 'Question navigation' }), { key: 'Escape' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(toggle);
});

it('does not mark a partly answered question group complete and clears all its parts', () => {
  const group = { ...questions[0], question_type: 'GROUP', content_html: 'Shared passage', options: [], children: questions.slice(1) };
  render(<Exam items={[group]} />);
  fireEvent.click(screen.getByRole('radio', { name: 'Answer 2' }));
  expect(screen.getByRole('button', { name: 'Question 1: Not answered' })).toBeTruthy();
  fireEvent.click(screen.getByRole('radio', { name: 'Answer 3' }));
  expect(screen.getByRole('button', { name: 'Question 1: Answered' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Response' }));
  expect(screen.getAllByRole('radio').every(el => el.getAttribute('aria-checked') === 'false')).toBe(true);
});

it('does not count a skipped numerical preview answer as correct or invent timing statistics', () => {
  const quiz = { title: 'Numerical preview', sections: [], questions: [{ id: 'n1', question_type: 'NUMERICAL', content_html: 'Enter the total', options: [], children: [], correct_answer: null }] } as unknown as Quiz;
  render(<QuizStudentPreview quiz={quiz} onClose={() => {}} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'Submit Quiz' })[0]);
  expect(screen.getByText('0 / 1')).toBeTruthy();
  expect(screen.queryByText('Skipped')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View answer' }));
  expect(screen.getByText('Submitted: Skipped')).toBeTruthy();
  expect(screen.queryByLabelText('Question statistics')).toBeNull();
});

it('dismisses the palette before closing the preview with Escape', () => {
  const quiz = { title: 'Preview', sections: [], questions: [{ id: 'n1', question_type: 'NUMERICAL', content_html: 'Enter the total', options: [], children: [] }] } as unknown as Quiz;
  const onClose = vi.fn();
  render(<QuizStudentPreview quiz={quiz} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Questions' }));
  fireEvent.keyDown(screen.getByRole('complementary', { name: 'Question navigation' }), { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();
  const toggle = screen.getByRole('button', { name: 'Questions' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.keyDown(toggle, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});
