import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import BundlesPage from '@/app/dashboard/bundles/page';
import NewBundlePage from '@/app/dashboard/bundles/new/page';
import type { Bundle } from '@/lib/api';

const mocks = vi.hoisted(() => ({ refetch: vi.fn(), create: vi.fn(), replace: vi.fn(), invalidate: vi.fn() }));
let permissions: string[];
let rows: Bundle[];
let error: Error | null;
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: () => ({ isLoading: false }) }));
vi.mock('@/hooks/use-permission', () => ({ usePermission: (permission: string) => permissions.includes(permission), usePermissions: () => ({ has: (permission: string) => permissions.includes(permission), isLoading: false }) }));
vi.mock('@/lib/queries/bundles', () => ({ useBundles: () => ({ data: rows, isPending: false, isFetching: false, error, refetch: mocks.refetch }) }));
vi.mock('@/lib/api', () => ({ createBundle: mocks.create }));
vi.mock('@/lib/useCurrentUrl', () => ({ useCurrentUrl: () => '/dashboard/bundles' }));
vi.mock('@/lib/mutations/invalidation', () => ({ useInvalidate: () => mocks.invalidate }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: mocks.replace }) }));
const bundle = (id: number): Bundle => ({ id: String(id), name: `Bundle ${id}`, description: id === 2 ? 'Language practice' : 'Number practice', course_count: id, student_count: id * 3, created_by: 'manager', created_at: `2026-09-${String(20 - id).padStart(2, '0')}` });
beforeEach(() => { vi.clearAllMocks(); rows = Array.from({ length: 8 }, (_, index) => bundle(index + 1)); permissions = ['bundles.create']; error = null; mocks.create.mockResolvedValue({ id: 'created' }); });

describe('Bundles catalogue', () => {
  it('uses whole-card links with return navigation and floating pagination', () => {
    render(<BundlesPage />);
    const card = screen.getByRole('link', { name: /Bundle 1 Number practice/ });
    expect(card.getAttribute('href')).toBe('/dashboard/bundles/1?from=%2Fdashboard%2Fbundles');
    expect(within(card).queryAllByRole('link')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('link', { name: /Bundle 7/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Bundle 1 Number practice/ })).toBeNull();
  });
  it('searches descriptions, resets the page, and clears an unmatched search', () => {
    render(<BundlesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search bundles' }), { target: { value: 'Language' } });
    expect(screen.getByRole('link', { name: /Bundle 2/ })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Bundle pages' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search bundles' }), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('link', { name: /Bundle 1 Number practice/ })).toBeTruthy();
  });
  it('sorts by real counts and retains order in list view without mutating query data', () => {
    render(<BundlesPage />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort bundles' }), { target: { value: 'courses' } });
    expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toBe('Bundle 8');
    expect(rows[0].name).toBe('Bundle 1');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    const table = screen.getByRole('table', { name: 'Bundles' });
    expect(within(table).getAllByRole('row')[1].textContent).toContain('Bundle 8');
  });
  it('keeps creation actions permission-gated and offers a retry on errors', () => {
    permissions = []; rows = [];
    const view = render(<BundlesPage />);
    expect(screen.queryByRole('link', { name: 'New bundle' })).toBeNull();
    expect(screen.getByText('Bundles will appear here when they’re available.')).toBeTruthy();
    error = new Error('Network unavailable'); view.rerender(<BundlesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});

describe('New bundle', () => {
  it('saves trimmed fields, invalidates bundles, and opens the created bundle', async () => {
    render(<NewBundlePage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Bundle name' }), { target: { value: '  Foundation  ' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Description/ }), { target: { value: '  Core learning  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create bundle' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ name: 'Foundation', description: 'Core learning' }));
    expect(mocks.invalidate).toHaveBeenCalledWith('bundles');
    expect(mocks.replace).toHaveBeenCalledWith('/dashboard/bundles/created');
  });
  it('retains entered values after a save fails', async () => {
    mocks.create.mockRejectedValue(new Error('Could not save'));
    render(<NewBundlePage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Bundle name' }), { target: { value: 'Foundation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create bundle' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Could not save');
    expect((screen.getByRole('textbox', { name: 'Bundle name' }) as HTMLInputElement).value).toBe('Foundation');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
