'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addCourseCollaborator, createCourse, removeCourseCollaborator, updateCourse } from '../api';
import { qk } from '../queries/keys';

/**
 * Layer 4 — course mutation hooks.
 *
 * onSuccess fires hierarchical invalidateQueries: invalidating ['og','courses']
 * (a prefix) drops every cached course-list variant regardless of its params,
 * and invalidating the specific ['og','course',id] drops that course's detail.
 * TanStack treats a query key as a prefix match, so the broad list key catches
 * all param permutations.
 */
export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createCourse>[0]) => createCourse(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['og', 'courses'] });
    },
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; payload: Parameters<typeof updateCourse>[1] }) =>
      updateCourse(args.id, args.payload),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ['og', 'courses'] });
      void qc.invalidateQueries({ queryKey: qk.course(args.id) });
    },
  });
}

export function useAddCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { courseId: string; userId: string }) =>
      addCourseCollaborator(args.courseId, args.userId),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ['og', 'courses'] });
      void qc.invalidateQueries({ queryKey: ['og', 'course-collaborators', args.courseId] });
    },
  });
}

export function useRemoveCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { courseId: string; userId: string }) =>
      removeCourseCollaborator(args.courseId, args.userId),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: ['og', 'courses'] });
      void qc.invalidateQueries({ queryKey: ['og', 'course-collaborators', args.courseId] });
    },
  });
}
