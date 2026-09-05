import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  grants: ['courses.create', 'test_bank.create'],
  sources: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), usePathname: () => '/dashboard/courses/duplicate' }));
vi.mock('../hooks/use-permission', () => ({ usePermissions: () => ({ has: (p: string) => state.grants.includes(p) }) }));
vi.mock('../lib/duplicate-material', () => ({
  getDuplicateSources: (...args: unknown[]) => { state.sources(...args); return Promise.resolve({ items: [{ id: 'source', title: 'Source material' }], total: 1, has_next: false }); },
}));
import { DuplicationBrowser } from '../components/duplication-browser';

afterEach(() => { cleanup(); state.grants = ['courses.create', 'test_bank.create']; vi.clearAllMocks(); });
function mount(kind: 'courses' | 'quizzes' = 'courses') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DuplicationBrowser kind={kind} /></QueryClientProvider>);
}

describe('duplication browse', () => {
  it('does not fetch material without create permission', async () => {
    state.grants = []; mount();
    expect(screen.getByText(/create permission/i)).toBeTruthy();
    expect(state.sources).not.toHaveBeenCalled();
  });

  it('sends a course to the course view', async () => {
    mount('courses');
    const open = await screen.findByRole('link', { name: 'Open Source material' });
    expect(open.getAttribute('href')).toContain('/dashboard/courses/source?mode=duplicate');
  });

  it('sends a quiz to the quiz view', async () => {
    mount('quizzes');
    const open = await screen.findByRole('link', { name: 'Open Source material' });
    expect(open.getAttribute('href')).toContain('/dashboard/quiz-builder/duplicate/source');
  });

  it('reads material in its own view, never inline — both kinds have one now', async () => {
    mount('quizzes');
    await screen.findByRole('link', { name: 'Open Source material' });
    expect(screen.queryByRole('button', { name: 'Preview Source material' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create copy' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Destination programme' })).toBeNull();
  });

  it('pages through the catalogue', async () => {
    mount();
    await screen.findByText('1 matching courses');
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search material' }), { target: { value: 'algebra' } });
    expect(state.sources).toHaveBeenCalledWith('courses', 'algebra', 1);
  });
});
