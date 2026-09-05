import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const state = vi.hoisted(() => ({ destinations: { requires_batch: true, programmes: [{ id: 'p1', name: 'Programme one', kind: 'UG' }], batches: [{ id: 'b1', name: 'Batch one', programme_id: 'p1' }] } }));
vi.mock('../lib/api', () => ({ getStudentCreationDestinations: async () => state.destinations }));
import { StudentCreationDestination } from '../components/student-creation-destination';
afterEach(() => cleanup());
describe('student creation destination', () => {
  it('automatically selects the sole assigned batch and its programme', async () => {
    const changed = vi.fn();
    render(<StudentCreationDestination value={{}} onChange={changed} />);
    await waitFor(() => expect(changed).toHaveBeenCalledWith({ batch_id: 'b1', programme_id: 'p1' }));
    expect(screen.getByText(/batch responsibility/i)).toBeTruthy();
  });
  it('requires an explicit selection when two assigned batches are available', async () => {
    state.destinations.batches.push({ id: 'b2', name: 'Batch two', programme_id: 'p1' });
    const changed = vi.fn();
    render(<StudentCreationDestination value={{}} onChange={changed} />);
    const selector = await screen.findByRole('combobox', { name: 'Initial batch' });
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(selector, { target: { value: 'b2' } });
    expect(changed).toHaveBeenCalledWith({ batch_id: 'b2', programme_id: 'p1' });
    state.destinations.batches.pop();
  });
});
