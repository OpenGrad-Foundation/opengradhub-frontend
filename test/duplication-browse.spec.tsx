import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  grants: ['courses.create', 'test_bank.create'],
  destinations: { programmes: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }], can_global: false },
  duplicateCourse: vi.fn(), duplicateQuiz: vi.fn(), sources: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/courses/duplicate' }));
vi.mock('../hooks/use-permission', () => ({ usePermissions: () => ({ has: (p: string) => state.grants.includes(p) }) }));
vi.mock('../lib/duplicate-material', () => ({
  getDuplicateSources: (...args: unknown[]) => { state.sources(...args); return Promise.resolve({ items: [{ id: 'source', title: 'Source material' }], total: 1, has_next: false }); },
  getDuplicateDestinations: () => Promise.resolve(state.destinations),
  getDuplicatePreview: () => Promise.resolve({ title: 'Source material', questions: [{ content_html: '<p>Question stem</p>', correct_answer: 'Answer key' }] }),
}));
vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), duplicateCourse: state.duplicateCourse, duplicateQuiz: state.duplicateQuiz }));
vi.mock('../app/dashboard/_components/MathContent', () => ({ MathContent: ({ html }: { html: string }) => <span>{html.replace(/<[^>]*>/g, '')}</span> }));
import { DuplicationBrowser } from '../components/duplication-browser';

afterEach(() => { cleanup(); state.grants = ['courses.create', 'test_bank.create']; state.destinations = { programmes: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }], can_global: false }; vi.clearAllMocks(); });
function mount(kind: 'courses' | 'quizzes' = 'courses') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DuplicationBrowser kind={kind} /></QueryClientProvider>);
}
describe('duplication browse', () => {
  it('does not fetch material without create permission', async () => {
    state.grants = []; mount();
    expect(screen.getByText(/create permission/i)).toBeTruthy();
    expect(state.sources).not.toHaveBeenCalled();
  });
  it('requires a destination choice for multiple programmes and sends the selected id', async () => {
    state.duplicateQuiz.mockResolvedValue({ id: 'copy', title: 'Copy created' }); mount('quizzes');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Source material' }));
    expect((await screen.findByRole('button', { name: 'Create copy' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Destination programme' }), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }));
    await waitFor(() => expect(state.duplicateQuiz).toHaveBeenCalledWith('source', 'p2'));
    expect(await screen.findByText('Created “Copy created”.')).toBeTruthy();
  });
  it('sends a course to its own view rather than dumping it inline', async () => {
    // A course has a curriculum worth walking, so reviewing one opens the course
    // view; only quizzes, which have no such view, are previewed in place.
    mount('courses');
    const open = await screen.findByRole('link', { name: 'Open Source material' });
    expect(open.getAttribute('href')).toContain('/dashboard/courses/source?mode=duplicate');
    expect(screen.queryByRole('button', { name: 'Preview Source material' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create copy' })).toBeNull();
  });
  it('automatically chooses the sole programme and previews answer keys without editing the original', async () => {
    state.destinations = { programmes: [{ id: 'p1', name: 'One' }], can_global: false };
    state.duplicateQuiz.mockResolvedValue({ id: 'copy', title: 'Quiz copy' }); mount('quizzes');
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Source material' }));
    expect(await screen.findByText('Answer key')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }));
    await waitFor(() => expect(state.duplicateQuiz).toHaveBeenCalledWith('source', 'p1'));
  });
});
