import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/quiz-builder/duplicate/q1', useSearchParams: () => new URLSearchParams() }));
vi.mock('../app/dashboard/_components/MathContent', () => ({
  MathContent: ({ html }: { html: string }) => <span>{html.replace(/<[^>]*>/g, '')}</span>,
  MathSnippet: ({ html }: { html: string }) => <span>{html.replace(/<[^>]*>/g, '')}</span>,
}));
vi.mock('../components/quiz-student-preview', () => ({
  QuizStudentPreview: ({ onClose }: { onClose: () => void }) => <div role='dialog'>student preview<button onClick={onClose}>close</button></div>,
}));

import { QuizMaterialView } from '../components/quiz-material-view';
import type { Question, Quiz } from '../lib/api';

afterEach(cleanup);

function question(over: Partial<Question> = {}): Question {
  return {
    id: 'qq1', quiz_id: null, question_type: 'MCQ', content_html: '<p>What is 2+2?</p>',
    correct_answer: null, tolerance: null, programme_type: null, subject: null, topic: null,
    difficulty: null, explanation_video_url: null, marks: 2, negative_marks: null,
    answer_time_minutes: null, instruction_html: null, evaluation_criteria_json: null,
    tag: null, solution: null, image_url: null, created_by: null,
    options: [
      { id: 'o1', option_text: 'Four', is_correct: true },
      { id: 'o2', option_text: 'Five', is_correct: false },
    ],
    children: [],
    ...over,
  } as Question;
}

const QUIZ: Quiz = {
  id: 'q1', module_id: null, title: 'Algebra Check', description: 'A short check',
  duration_minutes: 30, max_attempts: 2, pass_threshold_percent: 60,
  shuffle_questions: true, show_answers_after: false, quiz_type: 'GLOBAL_TEST',
  published: true, created_by: null, created_at: '2026-01-01T00:00:00Z',
  questions: [question()], is_sectioned: false, sequential_sections: false, sections: [],
  first_attempt_counts: false, require_fullscreen: false, negative_marking: true,
  correct_marks: 4, wrong_marks: 1, due_at: null, archived_at: null,
  owner_programme_name: 'UG Kerala',
};

describe('quiz material view', () => {
  it('leads with what the quiz is', () => {
    render(<QuizMaterialView quiz={QUIZ} />);
    expect(screen.getByText('Algebra Check')).toBeTruthy();
    expect(screen.getByText('A short check')).toBeTruthy();
    expect(screen.getByText('UG Kerala')).toBeTruthy();
  });

  it('shows the settings that decide whether the quiz is worth copying', () => {
    render(<QuizMaterialView quiz={QUIZ} />);
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    // Negative marking reads as the scheme, not a bare "Yes".
    expect(screen.getByText('+4 / −1')).toBeTruthy();
  });

  it('numbers the questions and marks the correct option', () => {
    render(<QuizMaterialView quiz={QUIZ} />);
    expect(screen.getByText(/Q1/)).toBeTruthy();
    expect(screen.getByText('What is 2+2?')).toBeTruthy();
    const four = screen.getByText('Four').closest('li');
    expect(four?.textContent).toContain('✓');
    expect(screen.getByText('Five').closest('li')?.textContent).not.toContain('✓');
  });

  it('states the answer for a question with no options', () => {
    const numerical = { ...QUIZ, questions: [question({ question_type: 'NUMERICAL', options: [], correct_answer: '42', solution: '<p>Because</p>' })] };
    render(<QuizMaterialView quiz={numerical} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Because')).toBeTruthy();
  });

  it('renders a group question with its children', () => {
    const grouped = {
      ...QUIZ,
      questions: [question({ id: 'parent', question_type: 'GROUP', content_html: '<p>Read the passage</p>', options: [], children: [question({ id: 'child', content_html: '<p>Child question</p>' })] })],
    };
    render(<QuizMaterialView quiz={grouped} />);
    expect(screen.getByText('Read the passage')).toBeTruthy();
    expect(screen.getByText('Child question')).toBeTruthy();
  });

  it('groups questions under their sections, with each section’s own rules', () => {
    const sectioned: Quiz = {
      ...QUIZ, is_sectioned: true, questions: [],
      sections: [
        { id: 's1', quiz_id: 'q1', title: 'Aptitude', order_index: 0, duration_minutes: 15, pass_threshold_percent: 50, questions: [question({ id: 'a1' })] },
        { id: 's2', quiz_id: 'q1', title: 'Logic', order_index: 1, duration_minutes: null, pass_threshold_percent: null, questions: [question({ id: 'b1', content_html: '<p>Logic question</p>' })] },
      ],
    };
    render(<QuizMaterialView quiz={sectioned} />);
    // Headings read "Section 1 · Aptitude", so match the title within them.
    expect(screen.getByText(/Section 1 · Aptitude/)).toBeTruthy();
    expect(screen.getByText(/Section 2 · Logic/)).toBeTruthy();
    expect(screen.getByText('Logic question')).toBeTruthy();
    expect(screen.getByText(/15 min/)).toBeTruthy();
  });

  it('keeps the student experience one click away rather than the only way in', () => {
    render(<QuizMaterialView quiz={QUIZ} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /preview as student/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('offers no authoring controls — this is somebody else’s quiz', () => {
    render(<QuizMaterialView quiz={QUIZ} />);
    expect(screen.queryByRole('button', { name: /edit|save|delete|add question/i })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('says so when the quiz has no questions at all', () => {
    render(<QuizMaterialView quiz={{ ...QUIZ, questions: [] }} />);
    expect(screen.getByText(/no questions/i)).toBeTruthy();
  });
});
