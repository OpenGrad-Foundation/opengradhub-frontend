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
  deleteRegister,
  retryRegisterExtraction,
  getAttendanceRecords,
  getStudentRecords,
  getClassRoster,
  putClassAttendance,
  getMyAttendance,
  getSchoolRegister,
  getRegisterGaps,
  type CommitEntry,
  type RecordsFilters,
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

/**
 * The canonical report. Disabled until a cohort is picked: the endpoint needs
 * exactly one of batch_id / course_id and would otherwise 400 on every mount.
 */
export function useAttendanceRecords(filters: RecordsFilters) {
  const enabled = !!filters.batch_id || !!filters.course_id;
  return useQuery({
    queryKey: qk.attendanceRecords(filters as Record<string, unknown>),
    queryFn: () => getAttendanceRecords(filters),
    enabled,
    staleTime: 60_000,
    retry: false, // a mixed cohort answers 400 by design — don't hammer it
  });
}

/** One student's timeline, carrying the grid's cohort and range through. */
export function useStudentRecords(
  studentId: string | null,
  filters: { batch_id?: string; course_id?: string; from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: qk.attendanceStudentRecords(studentId ?? '', filters as Record<string, unknown>),
    queryFn: () => getStudentRecords(studentId!, filters),
    enabled: !!studentId,
    staleTime: 60_000,
  });
}

/** The one roster view, for both marking and viewing. */
export function useClassRoster(liveClassId: string | null) {
  return useQuery({
    queryKey: qk.liveClassRoster(liveClassId ?? ''),
    queryFn: () => getClassRoster(liveClassId!),
    enabled: !!liveClassId,
    staleTime: 30_000,
  });
}

export function useMarkClassAttendance() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ liveClassId, marks }: {
      liveClassId: string;
      marks: { student_id: string; status: 'PRESENT' | 'ABSENT' }[];
    }) => putClassAttendance(liveClassId, marks),
    onSuccess: () => invalidate('liveClassAttendance'),
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
    mutationFn: (args: { school_id: string; images: File[] }) => uploadRegister(args),
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

export function useDeleteRegister() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteRegister(id),
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
