import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WidgetError from '@/components/dashboard/primitives/WidgetError';

describe('WidgetError', () => {
  it('renders error message and retry button calls onRetry', () => {
    let retried = false;
    render(<WidgetError message="Boom" onRetry={() => { retried = true; }} />);
    expect(screen.getByText('Boom')).toBeTruthy();
    screen.getByRole('button', { name: /retry/i }).click();
    expect(retried).toBe(true);
  });
});
