'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addCollaboratorFor, removeCollaboratorFor, type CollabResource } from '../api';

/**
 * Generic collaborator mutations for batches / quizzes / assignments —
 * same shape as the course hooks in mutations/courses.ts. The panel reloads
 * its own local list; onSuccess only drops the resource's cached domain so
 * manage-affordances (can_manage flags, filtered listings) refresh.
 */

const DOMAIN_KEY: Record<CollabResource, readonly string[]> = {
  batches: ['og', 'batches'],
  quizzes: ['og', 'quizzes'],
  assignments: ['og', 'assignments'],
};

export function useAddResourceCollaborator(resource: CollabResource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; userId: string }) =>
      addCollaboratorFor(resource, args.id, args.userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOMAIN_KEY[resource] });
    },
  });
}

export function useRemoveResourceCollaborator(resource: CollabResource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; userId: string }) =>
      removeCollaboratorFor(resource, args.id, args.userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DOMAIN_KEY[resource] });
    },
  });
}
