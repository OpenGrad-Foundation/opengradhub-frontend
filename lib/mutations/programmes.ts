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
  setProgrammeMember,
  updateProgramme,
  type ProgrammeContentKind,
  type ProgrammeLevel,
} from '../api';
import { qk } from '../queries/keys';

/**
 * Programme container writes.
 *
 * Membership and school writes stay inside the programme key family: they
 * change who administers a programme, which no other view renders.
 *
 * CONTENT writes do not, and this is the case the original note predicted.
 * Moving a course into a programme changes `can_manage` on the courses list for
 * every member of that programme, so the content mutations invalidate the
 * course and assignment families too. Without that, an EDITOR who was just
 * granted a course keeps seeing it read-only until their cache happens to
 * expire.
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

/**
 * Content assignment reaches outside the programme family — see the note above.
 * `qk.courses` is parameterised by filters, so invalidate the whole prefix
 * rather than guessing which filter combination is mounted.
 */
function useProgrammeContentInvalidation() {
  const qc = useQueryClient();
  return (id: string) => {
    void qc.invalidateQueries({ queryKey: qk.programme(id) });
    void qc.invalidateQueries({ queryKey: ['og', 'courses'] });
    void qc.invalidateQueries({ queryKey: ['og', 'course'] });
    void qc.invalidateQueries({ queryKey: qk.assignments() });
  };
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
