import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/courses/c1', useSearchParams: () => new URLSearchParams() }));
vi.mock('../app/dashboard/_components/MathContent', () => ({
  MathContent: ({ html }: { html: string }) => <span>{html.replace(/<[^>]*>/g, '')}</span>,
}));

import { CourseView } from '../app/dashboard/courses/_components/CourseView';
import { materialToCourseView } from '../lib/duplicate-material';

afterEach(cleanup);

const PREVIEW = {
  course: { id: 'c1', title: 'Algebra I', description: 'Intro', programme_type: 'UG', locking_mode: 'OPEN' },
  modules: [{
    id: 'm1', title: 'Module One', order_index: 0,
    lessons: [{ id: 'l1', title: 'Lesson A', youtube_url: 'https://youtu.be/a', duration_minutes: 10, notes_html: '<p>Lesson notes here</p>', order_index: 0 }],
    quizzes: [{
      id: 'q1', title: 'Check 1', order_index: 1, is_sectioned: false, sections: [],
      questions: [{ id: 'qq1', content_html: '<p>What is 2+2?</p>', options: [{ id: 'o1', option_text: '4', is_correct: true }] }],
    }],
  }],
};

function mountMaterial() {
  const { course, modules, quizMaterial } = materialToCourseView(PREVIEW);
  return render(<CourseView course={course} modules={modules} courseId="c1" isPreview variant="material" quizMaterial={quizMaterial} />);
}

describe('course view, material variant', () => {
  it('renders the course the way the ordinary view does', () => {
    mountMaterial();
    expect(screen.getByText('Algebra I')).toBeTruthy();
    expect(screen.getByText('Module One')).toBeTruthy();
    expect(screen.getByText('Lesson A')).toBeTruthy();
    expect(screen.getByText('Check 1')).toBeTruthy();
  });

  it('keeps lesson content closed until the row is opened', () => {
    mountMaterial();
    expect(screen.queryByText('Lesson notes here')).toBeNull();
    fireEvent.click(screen.getByText('Lesson A'));
    expect(screen.getByText('Lesson notes here')).toBeTruthy();
    expect(screen.getByRole('link', { name: /lesson video/i }).getAttribute('href')).toBe('https://youtu.be/a');
  });

  it('opens a quiz in place, answer key and all — no navigation to a route that would refuse it', () => {
    mountMaterial();
    expect(screen.queryByText('What is 2+2?')).toBeNull();
    fireEvent.click(screen.getByText('Check 1'));
    expect(screen.getByText('What is 2+2?')).toBeTruthy();
    // The shared question renderer marks the right option rather than labelling it.
    expect(screen.getByText('4').closest('li')?.textContent).toContain('✓');
  });

  it('offers no links out of the material, since those endpoints refuse a foreign course', () => {
    mountMaterial();
    fireEvent.click(screen.getByText('Lesson A'));
    const internal = screen.getAllByRole('link').filter(a => (a.getAttribute('href') ?? '').startsWith('/dashboard'));
    expect(internal).toEqual([]);
  });

  it('shows an unpublished quiz, which a copy would carry but the live course hides', () => {
    const withDraft = {
      ...PREVIEW,
      modules: [{ ...PREVIEW.modules[0], quizzes: [...PREVIEW.modules[0].quizzes, { id: 'q2', title: 'Draft quiz', order_index: 2, sections: [], questions: [] }] }],
    };
    const { course, modules, quizMaterial } = materialToCourseView(withDraft);
    render(<CourseView course={course} modules={modules} courseId="c1" isPreview variant="material" quizMaterial={quizMaterial} />);
    expect(screen.getByText('Draft quiz')).toBeTruthy();
  });
});

describe('course view, live variant', () => {
  it('still navigates to the real lesson route and hides unpublished quizzes', () => {
    const modules = [{
      id: 'm1', course_id: 'c1', title: 'Module One', order_index: 0,
      is_module_complete: false, is_locked: false,
      lessons: [{ id: 'l1', module_id: 'm1', title: 'Lesson A', youtube_url: '', duration_minutes: null, notes_html: null, order_index: 0, is_complete: false }],
      module_quizzes: [
        { id: 'q1', title: 'Live quiz', published: true, order_index: 1 },
        { id: 'q2', title: 'Draft quiz', published: false, order_index: 2 },
      ],
    }];
    const course = { id: 'c1', title: 'Algebra I', description: null, programme_type: 'UG', cover_image_url: null, locking_mode: 'OPEN', access_type: 'FREE', status: 'ACTIVE', tags: [], created_by: '', created_at: '', lesson_count: 1, quiz_count: 1 };
    render(<CourseView course={course} modules={modules} courseId="c1" isPreview variant="live" />);
    expect(screen.getByRole('link', { name: /Lesson A/ }).getAttribute('href')).toContain('/dashboard/courses/c1/lessons/l1');
    expect(screen.getByText('Live quiz')).toBeTruthy();
    expect(screen.queryByText('Draft quiz')).toBeNull();
  });
});
