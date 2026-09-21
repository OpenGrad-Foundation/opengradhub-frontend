import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInsightsOverview } from '@/lib/queries/dashboard/_insights-overview';
import { useDoubtsActivity } from '@/lib/queries/dashboard/_doubts-activity';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
let deniedPermission = '';
vi.mock('@/hooks/use-permission', () => ({ usePermissions: () => ({ has: (permission: string) => permission !== deniedPermission }) }));
import { apiFetch } from '@/lib/api';

beforeEach(() => { deniedPermission = ''; vi.clearAllMocks(); });

function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('dashboard unavailable data', () => {
  it('reports a failed analytics request instead of presenting zero metrics as successful data', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 503 }));
    const { result } = renderHook(() => useInsightsOverview('PROGRAM_MANAGER', 'pm'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('reports a partial activity failure instead of silently claiming the feed is empty', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) => String(url).endsWith('/doubts')
      ? new Response(null, { status: 503 })
      : Response.json([]));
    const { result } = renderHook(() => useDoubtsActivity('PROGRAM_MANAGER', 'pm'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('keeps permitted announcements when the user cannot view doubts', async () => {
    deniedPermission = 'doubts.view';
    vi.mocked(apiFetch).mockImplementation(async url => String(url).endsWith('/doubts')
      ? new Response(null, { status: 403 })
      : Response.json([{ id: 'notice', title: 'Term starts Monday', created_at: '2026-09-21T09:00:00Z' }]));
    const { result } = renderHook(() => useDoubtsActivity('PROGRAM_MANAGER', 'pm'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.items.map(item => item.text)).toEqual(['Term starts Monday']);
    expect(vi.mocked(apiFetch).mock.calls.some(([url]) => String(url).endsWith('/doubts'))).toBe(false);
  });
});
