'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  attachProgrammeSchool,
  createProgramme,
  detachProgrammeSchool,
  removeProgrammeMember,
  setProgrammeMember,
  updateProgramme,
  type ProgrammeLevel,
} from '../api';
import { qk } from '../queries/keys';

/**
 * Programme container writes.
 *
 * Invalidation stays inside the programme key family on purpose. The container
 * ships inert — no other view reads programme rows yet — so a write here cannot
 * make courses, batches or analytics stale. When the scope resolver lands and
 * programmes start deciding what people can see, this is the first place that
 * has to widen, or those views will serve pre-membership data.
 */

function useProgrammeInvalidation() {
  const qc = useQueryClient();
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['og', 'programmes'] });
    if (id) void qc.invalidateQueries({ queryKey: qk.programme(id) });
  };
}

export function useCreateProgramme() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createProgramme>[0]) => createProgramme(payload),
    onSuccess: (created) => invalidate(created.id),
  });
}

export function useUpdateProgramme() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; payload: Parameters<typeof updateProgramme>[1] }) =>
      updateProgramme(args.id, args.payload),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useSetProgrammeMember() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; userId: string; level: ProgrammeLevel }) =>
      setProgrammeMember(args.id, args.userId, args.level),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useRemoveProgrammeMember() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; userId: string }) =>
      removeProgrammeMember(args.id, args.userId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useAttachProgrammeSchool() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; schoolId: string }) =>
      attachProgrammeSchool(args.id, args.schoolId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useDetachProgrammeSchool() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; schoolId: string }) =>
      detachProgrammeSchool(args.id, args.schoolId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}
