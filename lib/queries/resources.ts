'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { getResources, updateResource, deleteResource } from '../api';
import { qk } from './keys';
import { useInvalidate } from '../mutations/invalidation';

/**
 * Layer 4 — resources hook. MEMORY ONLY, deliberately.
 *
 * This used to persist to IndexedDB keyed by `programmeType` alone. The
 * response is per-USER: it is filtered by the caller's batch enrolments and
 * their school, and each row carries `can_edit`/`can_delete` computed for the
 * caller. A cache keyed by cohort therefore survives a logout and serves one
 * user's rows — and one user's edit buttons — to the next person on the same
 * device. Same reasoning as the programme queries, which are memory-only for
 * the same reason.
 */
export function useResources(programmeType?: string) {
  return useQuery({
    queryKey: qk.resources(programmeType),
    queryFn: () => getResources(programmeType),
    staleTime: 30 * 60_000,
    gcTime: 2 * 60 * 60_000,
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
        school_ids?: string[];
      };
    }) => updateResource(id, payload),
    onSuccess: () => invalidate('resources'),
  });
}
