import { describe, expect, it } from 'vitest';
import { makeQueryClient } from '../lib/queries/query-client';
import { ApiError } from '../lib/api';
import { idbSet, idbGet } from '../lib/queries/persister';
import { hashKey } from '@tanstack/react-query';

describe('revoked query access', () => {
  it('removes an earlier protected response when refetch returns forbidden', async () => {
    const client = makeQueryClient();
    const key = ['og', 'student', 's1', 'profile'];
    client.setQueryData(key, { student: { name: 'Previously permitted student' } });
    await client.fetchQuery({ queryKey: key, staleTime: 0, retry: false, queryFn: () => Promise.reject(new ApiError('Forbidden', 403)) }).catch(() => undefined);
    expect(client.getQueryData(key)).toBeUndefined();
    client.clear();
  });
  it('keeps cached data for a temporary network failure', async () => {
    const client = makeQueryClient();
    const key = ['og', 'student', 's1', 'profile'];
    client.setQueryData(key, { student: { name: 'Still permitted student' } });
    await client.fetchQuery({ queryKey: key, staleTime: 0, retry: false, queryFn: () => Promise.reject(new Error('Network unavailable')) }).catch(() => undefined);
    expect(client.getQueryData(key)).toEqual({ student: { name: 'Still permitted student' } });
    client.clear();
  });
  it('also removes the persisted protected response after a denial', async () => {
    const client = makeQueryClient();
    const key = ['og', 'report', 's1', 'history'];
    const diskKey = `tanstack-query-${hashKey(key)}`;
    await idbSet(diskKey, 'old protected report');
    await client.fetchQuery({ queryKey: key, retry: false, queryFn: () => Promise.reject(new ApiError('Forbidden', 403)) }).catch(() => undefined);
    await expect.poll(() => idbGet(diskKey)).toBeUndefined();
    client.clear();
  });
});
