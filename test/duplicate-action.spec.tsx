import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  destinations: { programmes: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }], can_global: false },
  duplicateCourse: vi.fn(), duplicateQuiz: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/courses/duplicate', useSearchParams: () => new URLSearchParams() }));
vi.mock('../hooks/use-permission', () => ({ usePermissions: () => ({ has: () => true }) }));
vi.mock('../lib/duplicate-material', () => ({ getDuplicateDestinations: () => Promise.resolve(state.destinations) }));
vi.mock('../lib/api', async (original) => ({ ...await original<typeof import('../lib/api')>(), duplicateCourse: state.duplicateCourse, duplicateQuiz: state.duplicateQuiz }));
import { DuplicateAction } from '../components/duplicate-action';

afterEach(() => { cleanup(); state.destinations = { programmes: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }], can_global: false }; vi.clearAllMocks(); });
function mount(kind: 'courses' | 'quizzes' = 'courses') {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DuplicateAction kind={kind} sourceId='source' /></QueryClientProvider>);
}

describe('duplicate action', () => {
  it('requires a destination choice for multiple programmes and sends the selected id', async () => {
    state.duplicateCourse.mockResolvedValue({ id: 'copy', title: 'Copy created' }); mount();
    expect((await screen.findByRole('button', { name: 'Create copy' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Destination programme' }), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }));
    await waitFor(() => expect(state.duplicateCourse).toHaveBeenCalledWith('source', 'p2'));
    expect(await screen.findByText('Created “Copy created”.')).toBeTruthy();
  });

  it('automatically chooses the sole programme, with no picker to answer', async () => {
    state.destinations = { programmes: [{ id: 'p1', name: 'One' }], can_global: false };
    state.duplicateQuiz.mockResolvedValue({ id: 'copy', title: 'Quiz copy' }); mount('quizzes');
    expect(await screen.findByText('Destination: One')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }));
    await waitFor(() => expect(state.duplicateQuiz).toHaveBeenCalledWith('source', 'p1'));
  });

  it('sends null for a deliberately global copy', async () => {
    state.destinations = { programmes: [], can_global: true };
    state.duplicateCourse.mockResolvedValue({ id: 'copy', title: 'Global copy' }); mount();
    expect(await screen.findByText('Destination: Global')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create copy' }));
    await waitFor(() => expect(state.duplicateCourse).toHaveBeenCalledWith('source', null));
  });

  it('says so when there is nowhere the copy may land', async () => {
    state.destinations = { programmes: [], can_global: false }; mount();
    expect(await screen.findByText(/no permitted destination/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create copy' })).toBeNull();
  });
});
