import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeedItem from '@/components/dashboard/primitives/FeedItem';

describe('FeedItem', () => {
  it('renders text and timestamp', () => {
    render(<FeedItem icon="quiz" text="You scored 82%" timestamp="2h ago" />);
    expect(screen.getByText('You scored 82%')).toBeTruthy();
    expect(screen.getByText('2h ago')).toBeTruthy();
  });

  it('renders as a link when href provided', () => {
    render(<FeedItem icon="quiz" text="X" timestamp="now" href="/foo" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/foo');
  });
});
