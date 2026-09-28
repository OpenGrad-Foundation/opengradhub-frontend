import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ mutateAsync: vi.fn(async () => ({})) }));
vi.mock('../lib/queries/tracker', () => ({
  useUpdateTrackerTemplate: () => ({ mutateAsync: state.mutateAsync, isPending: false, isError: false, error: null }),
}));
import { EndTaskButton, TEMPLATE_STATUS_LABEL } from '../app/dashboard/tracker/_components/end-task';
afterEach(() => { cleanup(); state.mutateAsync.mockClear(); });

it('asks before ending, then archives the task and hands back', async () => {
  const onEnded = vi.fn();
  render(<EndTaskButton templateId="t1" name="Old survey" onEnded={onEnded} />);
  fireEvent.click(screen.getByRole('button', { name: 'End task' }));
  expect(screen.getByText('End “Old survey”?')).toBeTruthy();
  expect(state.mutateAsync).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole('button', { name: 'End task' })[1]);
  await waitFor(() => expect(onEnded).toHaveBeenCalled());
  expect(state.mutateAsync).toHaveBeenCalledWith({ status: 'archived' });
});

it('cancel leaves the task running', () => {
  const onEnded = vi.fn();
  render(<EndTaskButton templateId="t1" name="Old survey" onEnded={onEnded} />);
  fireEvent.click(screen.getByRole('button', { name: 'End task' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByText('End “Old survey”?')).toBeNull();
  expect(state.mutateAsync).not.toHaveBeenCalled();
  expect(onEnded).not.toHaveBeenCalled();
});

it('shows an archived task as Ended', () => {
  expect(TEMPLATE_STATUS_LABEL.archived).toBe('Ended');
});
