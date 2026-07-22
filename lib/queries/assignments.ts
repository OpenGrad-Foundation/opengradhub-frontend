'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { getAssignments, getSubmissionQueue, updateAssignment, deleteAssignment } from '../api';
import { qk } from './keys';
import { useInvalidate } from '../mutations/invalidation';

/** Layer 4 — Tier 2 assignments hook. Memory-only, 2 min staleTime. */
export function useAssignments() {
  return useQuery({
    queryKey: qk.assignments(),
    queryFn: () => getAssignments(),
    staleTime: 2 * 60_000,
  });
}

export function useSubmissionQueue(filters: {
  schoolId?: string;
  overdue?: boolean;
  status?: string;
  q?: string;
} = {}) {
  return useQuery({
    queryKey: qk.submissionQueue(filters),
    queryFn: () => getSubmissionQueue(filters),
    staleTime: 30_000,
  });
}

export function useUpdateAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    // Payload shape is derived from updateAssignment rather than restated, so a new
    // field on the API can't silently go missing here.
    mutationFn: ({ id, payload }: {
      id: string;
      payload: Parameters<typeof updateAssignment>[1];
    }) => updateAssignment(id, payload),
    onSuccess: () => invalidate('assignments'),
  });
}

export function useDeleteAssignment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSuccess: () => invalidate('assignments'),
  });
}
