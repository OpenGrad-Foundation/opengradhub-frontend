'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { getResources, updateResource, deleteResource } from '../api';
import { qk } from './keys';
import { makeIdbPersister } from './persister';
import { useInvalidate } from '../mutations/invalidation';

/** Layer 4 — Tier 1 (IDB-persisted) resources hook. 30 min stale / 2 h gc. */
export function useResources(programmeType?: string) {
  return useQuery({
    queryKey: qk.resources(programmeType),
    queryFn: () => getResources(programmeType),
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
    persister: makeIdbPersister(),
  });
}

export function useDeleteResource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => invalidate('resources'),
  });
}

export function useUpdateResource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: {
      id: string;
      payload: {
        title: string;
        description?: string;
        url: string;
        type?: string;
        programme_type?: string;
        batch_ids?: string[];
      };
    }) => updateResource(id, payload),
    onSuccess: () => invalidate('resources'),
  });
}
