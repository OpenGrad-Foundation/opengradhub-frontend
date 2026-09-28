import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const replaceMock = vi.fn();
let mockParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => mockParams,
  usePathname: () => '/dashboard/attendance',
}));

import { Tabs } from '@/app/dashboard/_components/Tabs';

const TABS = [
  { key: 'links', label: 'Live Classes', panel: <div>LINKS-PANEL</div> },
  { key: 'registers', label: 'Registers', panel: <div>REGISTERS-PANEL</div> },
  { key: 'overview', label: 'Overview', panel: <div>OVERVIEW-PANEL</div> },
];

function renderTabs() {
  return render(<Tabs tabs={TABS} ariaLabel="Attendance tabs" />);
}

describe('Tabs', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    mockParams = new URLSearchParams('');
  });

  it('renders one tab button per tab definition', () => {
    const { container } = renderTabs();
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Live Classes' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Registers' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy();
  });

  it('renders the first tab panel when no tab param is present', () => {
    renderTabs();
    expect(screen.getByText('LINKS-PANEL')).toBeTruthy();
    expect(screen.queryByText('REGISTERS-PANEL')).toBeNull();
  });

  it('renders the named tab panel when the tab param matches', () => {
    mockParams = new URLSearchParams('tab=registers');
    renderTabs();
    expect(screen.getByText('REGISTERS-PANEL')).toBeTruthy();
  });

  it('falls back to the first tab panel for an unknown tab param', () => {
    mockParams = new URLSearchParams('tab=does-not-exist');
    renderTabs();
    expect(screen.getByText('LINKS-PANEL')).toBeTruthy();
  });

  it('marks only the active tab as aria-selected', () => {
    mockParams = new URLSearchParams('tab=overview');
    renderTabs();
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Registers' }).getAttribute('aria-selected')).toBe('false');
  });

  it('replaces the URL with the clicked tab, without scrolling', () => {
    renderTabs();
    screen.getByRole('tab', { name: 'Registers' }).click();
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/attendance?tab=registers', { scroll: false });
  });

  it('preserves unrelated query params when switching tabs', () => {
    mockParams = new URLSearchParams('school_id=abc&tab=links');
    renderTabs();
    screen.getByRole('tab', { name: 'Overview' }).click();
    expect(replaceMock).toHaveBeenCalledWith(
      '/dashboard/attendance?school_id=abc&tab=overview',
      { scroll: false },
    );
  });

  it('renders nothing rather than crashing when handed no tabs', () => {
    const { container } = render(<Tabs tabs={[]} ariaLabel="Empty tabs" />);
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it('links each tab to its panel for assistive tech', () => {
    mockParams = new URLSearchParams('tab=registers');
    renderTabs();
    const active = screen.getByRole('tab', { name: 'Registers' });
    const panel = screen.getByRole('tabpanel');
    expect(active.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    expect(panel.getAttribute('aria-labelledby')).toBe(active.getAttribute('id'));
  });

  it('honours a custom param name', () => {
    mockParams = new URLSearchParams('view=overview');
    render(<Tabs tabs={TABS} ariaLabel="Attendance tabs" param="view" />);
    expect(screen.getByText('OVERVIEW-PANEL')).toBeTruthy();
  });
});
