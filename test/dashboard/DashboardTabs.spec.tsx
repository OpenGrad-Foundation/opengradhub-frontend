import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const replaceMock = vi.fn();
let mockParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockParams,
  usePathname: () => '/dashboard',
}));

import DashboardTabs from '@/app/dashboard/_components/DashboardTabs';

describe('DashboardTabs', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('renders two tab buttons', () => {
    mockParams = new URLSearchParams('');
    const { container } = render(
      <DashboardTabs
        overview={<div>OV</div>}
        activity={<div>AC</div>}
      />,
    );
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /overview/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /activity/i })).toBeTruthy();
  });

  it('renders Overview content by default', () => {
    mockParams = new URLSearchParams('');
    render(
      <DashboardTabs
        overview={<div>OV-CONTENT</div>}
        activity={<div>AC-CONTENT</div>}
      />,
    );
    expect(screen.getByText('OV-CONTENT')).toBeTruthy();
  });

  it('renders Activity content when ?tab=activity', () => {
    mockParams = new URLSearchParams('tab=activity');
    render(
      <DashboardTabs
        overview={<div>OV</div>}
        activity={<div>AC-CONTENT</div>}
      />,
    );
    expect(screen.getByText('AC-CONTENT')).toBeTruthy();
  });

  it('falls back to Overview for removed tasks tab', () => {
    mockParams = new URLSearchParams('tab=tasks');
    render(
      <DashboardTabs
        overview={<div>OV-CONTENT</div>}
        activity={<div>AC</div>}
      />,
    );
    expect(screen.getByText('OV-CONTENT')).toBeTruthy();
  });

  it('calls router.replace with new tab on click', () => {
    mockParams = new URLSearchParams('');
    const { container } = render(
      <DashboardTabs
        overview={<div>OV</div>}
        activity={<div>AC</div>}
      />,
    );
    const tabs = container.querySelectorAll('[role="tab"]');
    const activityButton = Array.from(tabs).find((btn) => btn.textContent === 'Activity') as HTMLElement;
    activityButton.click();
    expect(replaceMock).toHaveBeenCalledWith('/dashboard?tab=activity', { scroll: false });
  });
});
