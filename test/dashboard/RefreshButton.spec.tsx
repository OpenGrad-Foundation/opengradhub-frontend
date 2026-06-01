import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const invalidateMock = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateMock }),
}));

import RefreshButton from '@/components/dashboard/primitives/RefreshButton';

describe('RefreshButton', () => {
  it('invalidates the given queryKey on click', () => {
    render(<RefreshButton queryKey={['og', 'dashboard', 'STUDENT', 'overview']} />);
    screen.getByRole('button', { name: /refresh/i }).click();
    expect(invalidateMock).toHaveBeenCalledWith({
      queryKey: ['og', 'dashboard', 'STUDENT', 'overview'],
    });
  });
});
