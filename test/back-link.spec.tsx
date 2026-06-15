import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  usePathname: () => '/dashboard/quiz/9',
}));

import { BackLink } from '@/components/back-link';

afterEach(() => {
  cleanup();
  searchParams.delete('from');
});

describe('BackLink', () => {
  it('links to fallback when no from param', () => {
    render(<BackLink fallback="/dashboard/assessments">← Back</BackLink>);
    expect(screen.getByRole('link', { name: '← Back' }).getAttribute('href'))
      .toBe('/dashboard/assessments');
  });

  it('links to a valid from param', () => {
    searchParams.set('from', '/dashboard/courses/1/lessons/2');
    render(<BackLink fallback="/dashboard/assessments">← Back</BackLink>);
    expect(screen.getByRole('link', { name: '← Back' }).getAttribute('href'))
      .toBe('/dashboard/courses/1/lessons/2');
  });

  it('ignores a malicious from param', () => {
    searchParams.set('from', 'https://evil.com');
    render(<BackLink fallback="/dashboard/assessments">← Back</BackLink>);
    expect(screen.getByRole('link', { name: '← Back' }).getAttribute('href'))
      .toBe('/dashboard/assessments');
  });

  it('passes style through', () => {
    render(<BackLink fallback="/dashboard/bundles" style={{ color: 'rgb(32, 147, 121)' }}>← Back</BackLink>);
    expect((screen.getByRole('link', { name: '← Back' }) as HTMLElement).style.color)
      .toBe('rgb(32, 147, 121)');
  });
});
