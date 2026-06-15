import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/dashboard/primitives/EmptyState';

describe('EmptyState', () => {
  it('renders helperText', () => {
    render(<EmptyState helperText="Nothing here yet" />);
    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });

  it('uses a fallback when no helperText provided', () => {
    render(<EmptyState />);
    expect(screen.getByText(/—/)).toBeTruthy();
  });
});
