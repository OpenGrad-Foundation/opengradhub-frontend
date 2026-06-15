import { describe, it, expect } from 'vitest';
import { getBackHref, withFrom } from '@/lib/nav';

describe('getBackHref', () => {
  it('returns from when it is a dashboard path', () => {
    expect(getBackHref('/dashboard/courses/12/lessons/3', '/dashboard/assessments'))
      .toBe('/dashboard/courses/12/lessons/3');
  });

  it('returns fallback when from is null', () => {
    expect(getBackHref(null, '/dashboard/assessments')).toBe('/dashboard/assessments');
  });

  it('returns fallback when from is empty string', () => {
    expect(getBackHref('', '/dashboard/assessments')).toBe('/dashboard/assessments');
  });

  it('rejects absolute external URLs', () => {
    expect(getBackHref('https://evil.com/dashboard', '/dashboard/assessments'))
      .toBe('/dashboard/assessments');
  });

  it('rejects protocol-relative URLs', () => {
    expect(getBackHref('//evil.com/dashboard', '/dashboard/assessments'))
      .toBe('/dashboard/assessments');
  });

  it('rejects internal non-dashboard paths', () => {
    expect(getBackHref('/api/logout', '/dashboard/assessments'))
      .toBe('/dashboard/assessments');
  });

  it('rejects dashboard-prefixed strings containing a protocol scheme', () => {
    expect(getBackHref('/dashboard/x?u=javascript:alert(1)', '/dashboard/assessments'))
      .toBe('/dashboard/assessments');
  });

  it('accepts a from that itself carries a nested encoded from', () => {
    const nested = '/dashboard/quiz/9?from=' + encodeURIComponent('/dashboard/courses/1/lessons/2');
    expect(getBackHref(nested, '/dashboard/assessments')).toBe(nested);
  });
});

describe('withFrom', () => {
  it('appends ?from= to a plain href', () => {
    expect(withFrom('/dashboard/quiz/9', '/dashboard/assessments'))
      .toBe('/dashboard/quiz/9?from=%2Fdashboard%2Fassessments');
  });

  it('appends &from= when href already has a query', () => {
    expect(withFrom('/dashboard/quiz/9?tab=a', '/dashboard/assessments'))
      .toBe('/dashboard/quiz/9?tab=a&from=%2Fdashboard%2Fassessments');
  });

  it('encodes a currentUrl that itself contains a from param', () => {
    const current = '/dashboard/quiz/9?from=%2Fdashboard%2Fcourses%2F1';
    const out = withFrom('/dashboard/quiz/9/leaderboard', current);
    expect(out).toBe('/dashboard/quiz/9/leaderboard?from=' + encodeURIComponent(current));
  });
});
