import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
}));

import ChartCard from '@/components/dashboard/primitives/ChartCard';

describe('ChartCard', () => {
  const sampleData = {
    labels: ['Q1', 'Q2'],
    datasets: [{ label: 'Score', data: [70, 80] }],
  };

  it('renders title and chart when data present', () => {
    render(<ChartCard title="Scores" variant="line" data={sampleData} />);
    expect(screen.getByText('Scores')).toBeTruthy();
    expect(screen.getByTestId('chart-line')).toBeTruthy();
  });

  it('renders bar variant when requested', () => {
    render(<ChartCard title="Bars" variant="bar" data={sampleData} />);
    expect(screen.getByTestId('chart-bar')).toBeTruthy();
  });

  it('renders EmptyState when datasets are empty', () => {
    render(
      <ChartCard
        title="Empty"
        variant="line"
        data={{ labels: [], datasets: [] }}
        emptyHelper="No data yet"
      />
    );
    expect(screen.getByText('No data yet')).toBeTruthy();
  });

  it('renders skeleton when isLoading', () => {
    const { container } = render(
      <ChartCard title="L" variant="line" data={sampleData} isLoading />
    );
    expect(container.querySelector('[data-testid="chart-skeleton"]')).toBeTruthy();
  });
});
