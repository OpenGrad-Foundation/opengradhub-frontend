import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TaskItem from '@/components/dashboard/primitives/TaskItem';

describe('TaskItem', () => {
  it('renders title, subtitle, and action label', () => {
    render(
      <TaskItem
        icon="doubt"
        title="3 doubts to answer"
        subtitle="Oldest: 2 days ago"
        actionHref="/dashboard/doubts"
        actionLabel="Open"
      />
    );
    expect(screen.getByText('3 doubts to answer')).toBeTruthy();
    expect(screen.getByText('Oldest: 2 days ago')).toBeTruthy();
    const link = screen.getByRole('link', { name: /open/i });
    expect(link.getAttribute('href')).toBe('/dashboard/doubts');
  });
});
