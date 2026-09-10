'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  assignProgrammeContent,
  attachProgrammeBatch,
  attachProgrammeSchool,
  createProgramme,
  detachProgrammeBatch,
  detachProgrammeSchool,
  releaseProgrammeContent,
  removeProgrammeMember,
  addProgrammeMember,
  addProgrammeStudents,
  updateProgramme,
  type ProgrammeContentKind,
} from '../api';
import { DOMAIN_KEYS } from './invalidation';

/** Programme changes can alter reach, ownership and administrative access. */
function useProgrammeInvalidation() {
  const qc = useQueryClient();
  return (_id?: string) => {
    for (const queryKey of DOMAIN_KEYS.programmes) void qc.invalidateQueries({ queryKey });
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

export function useAddProgrammeMember() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; userId: string }) =>
      addProgrammeMember(args.id, args.userId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useAddProgrammeStudents() {
  const invalidate = useProgrammeInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; userIds: string[] }) =>
      addProgrammeStudents(args.id, args.userIds),
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

function useProgrammeContentInvalidation() {
  return useProgrammeInvalidation();
}

export function useAssignProgrammeContent() {
  const invalidate = useProgrammeContentInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; kind: ProgrammeContentKind; resourceId: string }) =>
      assignProgrammeContent(args.id, args.kind, args.resourceId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useReleaseProgrammeContent() {
  const invalidate = useProgrammeContentInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; kind: ProgrammeContentKind; resourceId: string }) =>
      releaseProgrammeContent(args.id, args.kind, args.resourceId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

/**
 * Batch attachment reaches the course families for the same reason content
 * does — but in the opposite direction. Attaching a batch can REVOKE another
 * programme's editors' rights via the consumer closure, so a stale can_manage
 * would show an edit button the server now refuses.
 */
export function useAttachProgrammeBatch() {
  const invalidate = useProgrammeContentInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; batchId: string }) =>
      attachProgrammeBatch(args.id, args.batchId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}

export function useDetachProgrammeBatch() {
  const invalidate = useProgrammeContentInvalidation();
  return useMutation({
    mutationFn: (args: { id: string; batchId: string }) =>
      detachProgrammeBatch(args.id, args.batchId),
    onSuccess: (_d, args) => invalidate(args.id),
  });
}
