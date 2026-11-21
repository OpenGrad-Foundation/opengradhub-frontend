import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const invalidateMock = vi.fn(() => Promise.resolve());
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateMock }),
}));

import RefreshButton from '@/components/dashboard/primitives/RefreshButton';

describe('RefreshButton', () => {
  it('invalidates the given queryKey on click', () => {
    render(<RefreshButton queryKey={['og', 'dashboard', 'STUDENT', 'overview']} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(invalidateMock).toHaveBeenCalledWith({
      queryKey: ['og', 'dashboard', 'STUDENT', 'overview'],
    }, { cancelRefetch: false });
  });

  it('invalidates without fetching when the widget supplies its own refetch', async () => {
    invalidateMock.mockClear();
    const refetch = vi.fn();
    const queryKey = ['og', 'dashboard', 'STUDENT', 'overview'];
    render(<RefreshButton queryKey={queryKey} onRefresh={refetch} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(invalidateMock).toHaveBeenCalledExactlyOnceWith({ queryKey, refetchType: 'none' });
    await waitFor(() => expect(refetch).toHaveBeenCalledOnce());
  });

  it('shows a busy state while refreshing, then re-enables', async () => {
    render(<RefreshButton queryKey={['og', 'dashboard', 'STUDENT', 'activity']} />);
    const button = screen.getByRole('button', { name: /refresh/i }) as HTMLButtonElement;

    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toMatch(/refreshing/i);

    await waitFor(() => expect(button.disabled).toBe(false), { timeout: 2000 });
    expect(button.textContent).toMatch(/^refresh$/i);
  });
});
