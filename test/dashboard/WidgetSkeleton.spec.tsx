import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WidgetSkeleton from '@/components/dashboard/primitives/WidgetSkeleton';

describe('WidgetSkeleton', () => {
  it('renders stat variant', () => {
    const { container } = render(<WidgetSkeleton variant="stat" />);
    expect(container.querySelector('[data-variant="stat"]')).toBeTruthy();
  });

  it('renders chart variant', () => {
    const { container } = render(<WidgetSkeleton variant="chart" />);
    expect(container.querySelector('[data-variant="chart"]')).toBeTruthy();
  });

  it('renders list variant', () => {
    const { container } = render(<WidgetSkeleton variant="list" />);
    expect(container.querySelector('[data-variant="list"]')).toBeTruthy();
  });
});
