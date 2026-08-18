'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { addSchoolLinksBatch } from '@/lib/attendance-bulk';
import {
  getClassLinks,
  generateClassLinks,
  addSchoolLink,
  removeLink,
  overrideLink,
  regenerateLink,
  getSheetData,
  uploadRegister,
  getRegisterUpload,
  setRegisterMonth,
  commitRegister,
  discardRegister,
  retryRegisterExtraction,
  getAttendanceSummary,
  getMyAttendance,
  getSchoolRegister,
  getRegisterGaps,
  type CommitEntry,
} from '../attendance-api';
import { useInvalidate } from '../mutations/invalidation';
import { qk } from './keys';

// ── Reads ─────────────────────────────────────────────────────────────────────

export function useClassLinks(classId: string | null) {
  return useQuery({
    queryKey: qk.attendanceLinks(classId ?? ''),
    queryFn: () => getClassLinks(classId!),
    enabled: !!classId,
    staleTime: 30_000,
  });
}

export function useRegisterUpload(id: string | null) {
  return useQuery({
    queryKey: qk.attendanceRegister(id ?? ''),
    queryFn: () => getRegisterUpload(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useAttendanceSummary() {
  return useQuery({
    queryKey: qk.attendanceSummary(),
    queryFn: getAttendanceSummary,
    staleTime: 60_000,
  });
}

export function useMyAttendance() {
  return useQuery({
    queryKey: qk.attendanceMe(),
    queryFn: getMyAttendance,
    staleTime: 60_000,
  });
}

/** `month` is optional: the printed sheet leaves it blank for the school. */
export function useSheetData(schoolId: string | null, month?: string | null) {
  return useQuery({
    queryKey: qk.attendanceSheet(schoolId ?? '', month ?? ''),
    queryFn: () => getSheetData(schoolId!, month),
    enabled: !!schoolId,
    staleTime: 60_000,
  });
}

/**
 * Schools owing a register for the last completed month. Dashboard cadence:
 * 5-minute staleness and no focus refetch, matching the other overview widgets.
 */
export function useRegisterGaps(enabled = true) {
  return useQuery({
    queryKey: qk.attendanceGaps(),
    queryFn: getRegisterGaps,
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Committed register attendance for one school — the school detail page panel. */
export function useSchoolRegister(schoolId: string | null, month: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.attendanceSchoolRegister(schoolId ?? '', month ?? ''),
    queryFn: () => getSchoolRegister(schoolId!, month),
    enabled: enabled && !!schoolId,
    staleTime: 60_000,
    retry: false, // a role without attendance.view gets a 403 — don't hammer it
  });
}

// ── Writes (all bust the attendance domain) ──────────────────────────────────

export function useGenerateLinks() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (classId: string) => generateClassLinks(classId),
    onSuccess: () => invalidate('attendance'),
  });
}

/**
 * Links several schools to a live class in one interaction. The endpoint is
 * one-school-per-call, so this fans out (bounded) and reports per-school
 * failures; `onSettled` invalidates exactly once for the whole batch rather
 * than once per school.
 */
export function useAddSchoolLinks() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ classId, schoolIds }: { classId: string; schoolIds: string[] }) =>
      addSchoolLinksBatch(schoolIds, (schoolId) => addSchoolLink(classId, schoolId)),
    onSettled: () => invalidate('attendance'),
  });
}

export function useRemoveLink() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (linkId: string) => removeLink(linkId),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useOverrideLink() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ linkId, attended }: { linkId: string; attended: boolean }) =>
      overrideLink(linkId, attended),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useRegenerateLink() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (linkId: string) => regenerateLink(linkId),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useUploadRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { school_id: string; image: File }) => uploadRegister(args),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useSetRegisterMonth() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, month }: { id: string; month: string }) => setRegisterMonth(id, month),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useCommitRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, entries }: { id: string; entries: CommitEntry[] }) =>
      commitRegister(id, entries),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useDiscardRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => discardRegister(id),
    onSuccess: () => invalidate('attendance'),
  });
}

export function useRetryExtraction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => retryRegisterExtraction(id),
    onSuccess: () => invalidate('attendance'),
  });
}
