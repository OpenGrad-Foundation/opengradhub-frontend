import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
const state = vi.hoisted(() => ({ search: 'view=past' }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/live-classes', useSearchParams: () => new URLSearchParams(state.search), useRouter: () => ({ replace: (url: string) => { state.search = url.split('?')[1] ?? ''; } }) }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ data: { user: { id: 'staff' } }, isLoading: false }) }));
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({ has: () => true }) }));
vi.mock('@/lib/mutations/invalidation', () => ({ useInvalidate: () => vi.fn() }));
vi.mock('@/lib/queries/batches', () => ({ useBatches: () => ({ data: [] }) }));
vi.mock('@/lib/api', () => ({ getCourses: async () => [], deleteLiveClass: vi.fn(), joinLiveClass: vi.fn() }));
vi.mock('@/app/dashboard/live-classes/_components/ClassRoster', () => ({ ClassRoster: () => null }));
vi.mock('@/lib/queries/live-classes', () => ({ useLiveClasses: () => ({ data: [
  { id: 'old', title: 'Older class', scheduled_at: '2025-08-28T15:00:00Z', duration_minutes: 120 },
  { id: 'new', title: 'Newer class', scheduled_at: '2026-08-28T15:00:00Z', duration_minutes: 120 },
], isPending: false, refetch: vi.fn() }) }));
import LiveClassesPage from '@/app/dashboard/live-classes/page';
afterEach(cleanup);
beforeEach(() => { state.search = 'view=past'; });
function before(first: string, second: string) {
  return !!(screen.getAllByText(first)[0].compareDocumentPosition(screen.getAllByText(second)[0]) & Node.DOCUMENT_POSITION_FOLLOWING);
}
it('shows newest past classes first and lets the user reverse the order', async () => {
  const view = render(<LiveClassesPage />);
  await act(async () => {});
  expect(before('Newer class', 'Older class')).toBe(true);
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort classes' }), { target: { value: 'oldest' } });
  view.rerender(<LiveClassesPage />);
  expect(before('Older class', 'Newer class')).toBe(true);
});
it('keeps the soonest upcoming class first', async () => {
  state.search = ''; render(<LiveClassesPage />);
  await act(async () => {});
  expect(before('Older class', 'Newer class')).toBe(true);
  expect((screen.getByRole('combobox', { name: 'Sort classes' }) as HTMLSelectElement).value).toBe('oldest');
});
