import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '@/components/dashboard/primitives/StatCard';

describe('StatCard', () => {
  it('renders value and label', () => {
    render(<StatCard label="Students" value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('Students')).toBeTruthy();
  });

  it('renders helperText when value is empty (0 or null)', () => {
    render(<StatCard label="Quizzes" value={0} helperText="No quizzes yet" />);
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('No quizzes yet')).toBeTruthy();
  });

  it('falls back to em-dash when value is null and no helperText', () => {
    render(<StatCard label="Avg" value={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders loading skeleton when isLoading', () => {
    const { container } = render(<StatCard label="Loading" value={null} isLoading />);
    expect(container.querySelector('[data-testid="stat-skeleton"]')).toBeTruthy();
  });

  it('renders error state with onRetry callback', () => {
    let retried = false;
    render(
      <StatCard
        label="Err"
        value={null}
        error="boom"
        onRetry={() => { retried = true; }}
      />
    );
    expect(screen.getByText('boom')).toBeTruthy();
    screen.getByRole('button', { name: /retry/i }).click();
    expect(retried).toBe(true);
  });
});
