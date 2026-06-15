import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListCard from '@/components/dashboard/primitives/ListCard';

describe('ListCard', () => {
  it('renders title and children', () => {
    render(
      <ListCard title="Recent">
        <div>row 1</div>
        <div>row 2</div>
      </ListCard>,
    );
    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByText('row 1')).toBeTruthy();
  });

  it('renders empty state when no children', () => {
    render(<ListCard title="Empty" emptyHelper="Nothing here yet" />);
    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });

  it('renders skeleton when isLoading', () => {
    const { container } = render(<ListCard title="L" isLoading />);
    expect(container.querySelector('[data-testid="list-skeleton"]')).toBeTruthy();
  });
});
