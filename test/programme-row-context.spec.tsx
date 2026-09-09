import React from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRowNavigation } from '../app/dashboard/programmes/_components/use-row-navigation';
import { EntityLink } from '../app/dashboard/programmes/_components/entity-link';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard/programmes/p1',
  useSearchParams: () => new URLSearchParams('tab=students&q=Priya&page=2'),
}));
vi.mock('../hooks/use-permission', () => ({ useAnyPermission: () => true, usePermissions: () => ({ has: () => true }) }));
afterEach(() => { cleanup(); push.mockReset(); });
function Table() {
  const rowNav = useRowNavigation();
  return <table><tbody><tr {...rowNav('/dashboard/students/s1')}><td>
    <EntityLink href='/dashboard/students/s1' permissions={['students.view']}>Priya</EntityLink>
  </td><td>Roll 001</td></tr></tbody></table>;
}
describe('programme row navigation', () => {
  it('uses the same full return context from both the row and the name', () => {
    render(<Table />);
    const href = screen.getByRole('link').getAttribute('href');
    fireEvent.click(screen.getByText('Roll 001'));
    expect(push).toHaveBeenCalledWith(href);
    expect(new URL(href!, 'https://local').searchParams.get('from')).toBe('/dashboard/programmes/p1?tab=students&q=Priya&page=2');
  });
  it('leaves modified clicks and anchors to the browser', () => {
    render(<Table />);
    fireEvent.click(screen.getByText('Roll 001'), { metaKey: true });
    screen.getByRole('link').addEventListener('click', event => event.preventDefault());
    fireEvent.click(screen.getByRole('link'));
    expect(push).not.toHaveBeenCalled();
  });
});
