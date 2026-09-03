'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  assignTrackerTargets,
  clearTrackerBlocker,
  createTrackerTemplate,
  getTrackerGrid,
  getTrackerMineBlockers,
  getTrackerQueueBlockers,
  getTrackerAssignable,
  getTrackerMyProgrammes,
  getPartnerTasks,
  getPartnerFacets,
  getPartnerBreakdown,
  getPartnerRecords,
  getPartnerProofs,
  addBlockerComment,
  getBlockerThread,
  getTrackerFellows,
  getTrackerFellowTasks,
  getTrackerAllTasks,
  getTrackerTaskSummary,
  getTrackerTaskBreakdown,
  getTrackerFacets,
  type TrackerTaskSummaryFilters,
  type TrackerTaskState,
  type TrackerDrillLevel,
  getTrackerZms,
  getTrackerZmFellows,
  getTrackerFellowSchools,
  getTrackerSchoolStudents,
  getTrackerPms,
  getTrackerPmZms,
  type TrackerAllTasksFilters,
  getTrackerMyTasks,
  getTrackerOverview,
  getTrackerRecordHistory,
  getTrackerSummary,
  getTrackerTemplate,
  getTrackerTemplates,
  raiseTrackerBlocker,
  saveTrackerBatch,
  saveTrackerBatchOnBehalf,
  updateTrackerTemplate,
  updateTrackerField,
  deleteTrackerField,
  deleteTrackerTemplate,
  getTrackerProofs,
  uploadProofPhoto,
  captureProofLocation,
  deleteProofPhoto,
  nudgeTracker,
  listStudentFields,
  createStudentField,
  updateStudentField,
  deleteStudentField,
  getStudentDetails,
  saveStudentDetails,
  listProfilePaths,
  type AddTrackerFieldsInput,
  type CreateTrackerTemplateInput,
  type CreateStudentFieldInput,
  type StudentFieldPatch,
  type TrackerBatchEdit,
  type TrackerStudentFieldStatus,
  type TrackerTargetType,
  type TrackerTemplatePatch,
  type TrackerFieldPatch,
  addTrackerFields,
} from '../tracker-api';
import { useInvalidate } from '../mutations/invalidation';
import {
  getRecordExtensions,
  grantExtension,
  getRecordPeriodHistory,
  getStudentTrackerTasks,
  getTemplateGeoVerifications,
  getRecordGeoVerification,
  uploadGeoVerification,
  overrideGeoVerification,
} from '../tracker-api';
import { qk } from './keys';

export function useTrackerTemplates(status?: string) {
  return useQuery({
    queryKey: qk.trackerTemplates(status),
    queryFn: () => getTrackerTemplates(status),
    staleTime: 2 * 60_000,
  });
}

export function useTrackerTemplate(id: string | undefined) {
  return useQuery({
    queryKey: qk.trackerTemplate(id ?? ''),
    queryFn: () => getTrackerTemplate(id as string),
    enabled: Boolean(id),
    staleTime: 2 * 60_000,
  });
}

export function useTrackerGrid(templateId: string | undefined, fellowId?: string) {
  return useQuery({
    queryKey: qk.trackerGrid(templateId ?? '', fellowId ?? ''),
    queryFn: () => getTrackerGrid(templateId as string, fellowId),
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });
}

export function useTrackerSummary(templateId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerSummary(templateId ?? ''),
    queryFn: () => getTrackerSummary(templateId as string),
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });
}

export function useTrackerOverview(enabled = true) {
  return useQuery({
    queryKey: qk.trackerOverview(),
    queryFn: getTrackerOverview,
    enabled,
    staleTime: 30_000,
  });
}

export function useTrackerFellows(enabled = true) {
  return useQuery({
    queryKey: qk.trackerFellows(),
    queryFn: getTrackerFellows,
    enabled,
    staleTime: 60_000,
  });
}

export function useTrackerFellowTasks(fellowId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerFellowTasks(fellowId ?? ''),
    queryFn: () => getTrackerFellowTasks(fellowId as string),
    enabled: Boolean(fellowId),
    staleTime: 30_000,
  });
}

export function useTrackerAllTasks(filters: TrackerAllTasksFilters, enabled = true) {
  return useQuery({
    queryKey: qk.trackerAllTasks(filters as Record<string, unknown>),
    queryFn: () => getTrackerAllTasks(filters),
    enabled,
    staleTime: 30_000,
  });
}

export function useTrackerTaskSummary(filters: TrackerTaskSummaryFilters, enabled = true) {
  return useQuery({
    queryKey: qk.trackerTaskSummary(filters as Record<string, unknown>),
    queryFn: () => getTrackerTaskSummary(filters),
    enabled,
    staleTime: 30_000,
  });
}

export function useTrackerTaskBreakdown(
  templateId: string | undefined,
  level: TrackerDrillLevel,
  parentId: string | undefined,
  q: string,
  page: number,
  status?: TrackerTaskState,
) {
  return useQuery({
    // `status` belongs in the key: without it, switching status would serve the
    // previous status's rows out of cache.
    queryKey: qk.trackerTaskBreakdown(templateId ?? '', level, parentId ?? '', q, status ?? '', page),
    queryFn: () => getTrackerTaskBreakdown(templateId as string, {
      level, parentId, q: q || undefined, status, page,
    }),
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });
}

/** Filter dropdown options for the caller's scope. Rarely changes, so cached longer. */
export function useTrackerFacets(enabled = true) {
  return useQuery({
    queryKey: qk.trackerFacets(),
    queryFn: getTrackerFacets,
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useTrackerZms(enabled = true) {
  return useQuery({ queryKey: qk.trackerZms(), queryFn: getTrackerZms, enabled, staleTime: 60_000 });
}

export function useTrackerZmFellows(zmId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerZmFellows(zmId ?? ''),
    queryFn: () => getTrackerZmFellows(zmId as string),
    enabled: Boolean(zmId),
    staleTime: 30_000,
  });
}

export function useTrackerFellowSchools(fellowId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerFellowSchools(fellowId ?? ''),
    queryFn: () => getTrackerFellowSchools(fellowId as string),
    enabled: Boolean(fellowId),
    staleTime: 30_000,
  });
}

export function useTrackerSchoolStudents(schoolId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerSchoolStudents(schoolId ?? ''),
    queryFn: () => getTrackerSchoolStudents(schoolId as string),
    enabled: Boolean(schoolId),
    staleTime: 30_000,
  });
}

export function useTrackerPms(enabled = true) {
  return useQuery({ queryKey: qk.trackerPms(), queryFn: getTrackerPms, enabled, staleTime: 60_000 });
}

export function useTrackerPmZms(pmId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerPmZms(pmId ?? ''),
    queryFn: () => getTrackerPmZms(pmId as string),
    enabled: Boolean(pmId),
    staleTime: 30_000,
  });
}

export function useTrackerMineBlockers() {
  return useQuery({
    queryKey: qk.trackerBlockersMine(),
    queryFn: getTrackerMineBlockers,
    staleTime: 30_000,
  });
}

export function useTrackerQueueBlockers() {
  return useQuery({
    queryKey: qk.trackerBlockersQueue(),
    queryFn: getTrackerQueueBlockers,
    staleTime: 30_000,
  });
}

export function useTrackerAssignable(targetType: TrackerTargetType, enabled = true, batchId?: string) {
  return useQuery({
    queryKey: [...(qk.trackerAssignable(targetType) as readonly unknown[]), batchId ?? ""],
    queryFn: () => getTrackerAssignable(targetType, batchId || undefined),
    enabled,
    staleTime: 60_000,
  });
}

/** The programmes this author may attach a new task type to. Long stale time: a
 *  programme roster changes far less often than a task type is authored. */
export function useTrackerMyProgrammes(enabled = true) {
  return useQuery({
    queryKey: qk.trackerMyProgrammes(),
    queryFn: getTrackerMyProgrammes,
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ── the partner surface ──────────────────────────────────────────────────────
// Keyed on the serialised filter set so each distinct view caches separately,
// rather than one key thrashing as an official narrows their filters.

export function usePartnerTasks(params: Record<string, unknown>) {
  return useQuery({
    queryKey: qk.partnerTasks(JSON.stringify(params)),
    queryFn: () => getPartnerTasks(params),
    staleTime: 30_000,
    // An official paging through history should not see the table blank between
    // pages; the previous page stays until the next resolves.
    placeholderData: (prev) => prev,
  });
}

export function usePartnerFacets() {
  return useQuery({
    queryKey: qk.partnerFacets(),
    queryFn: getPartnerFacets,
    // Dropdown options change when someone shares a task or attaches a school,
    // neither of which happens while an official is reading.
    staleTime: 5 * 60_000,
  });
}

export function usePartnerBreakdown(
  templateId: string | null,
  params: { level: string; state?: string; district?: string; schoolId?: string },
) {
  return useQuery({
    queryKey: qk.partnerBreakdown(templateId ?? "", JSON.stringify(params)),
    queryFn: () => getPartnerBreakdown(templateId as string, params),
    enabled: Boolean(templateId),
    staleTime: 30_000,
  });
}

export function usePartnerRecords(templateId: string | null, params: Record<string, unknown>) {
  return useQuery({
    queryKey: qk.partnerRecords(templateId ?? "", JSON.stringify(params)),
    queryFn: () => getPartnerRecords(templateId as string, params),
    enabled: Boolean(templateId),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function usePartnerProofs(recordId: string | null) {
  return useQuery({
    queryKey: qk.partnerProofs(recordId ?? ""),
    queryFn: () => getPartnerProofs(recordId as string),
    enabled: Boolean(recordId),
    // Presigned URLs expire. Caching them past that would show an official a
    // broken image and no reason for it, so this refetches rather than reuses.
    staleTime: 0,
    gcTime: 60_000,
  });
}

export function useTrackerMyTasks(enabled = true) {
  return useQuery({
    queryKey: qk.trackerMyTasks(),
    queryFn: getTrackerMyTasks,
    enabled,
    staleTime: 30_000,
  });
}

export function useTrackerRecordHistory(recordId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerRecordHistory(recordId ?? ''),
    queryFn: () => getTrackerRecordHistory(recordId as string),
    enabled: Boolean(recordId),
    staleTime: 15_000,
  });
}

export function useBlockerThread(blockerId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerBlockerThread(blockerId ?? ''),
    queryFn: () => getBlockerThread(blockerId as string),
    enabled: Boolean(blockerId),
    staleTime: 5_000,
  });
}

export function useAddBlockerComment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ blockerId, text }: { blockerId: string; text: string }) => addBlockerComment(blockerId, text),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useCreateTrackerTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateTrackerTemplateInput) => createTrackerTemplate(input),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useAddTrackerFields(templateId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AddTrackerFieldsInput) => addTrackerFields(templateId, input),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useAssignTrackerTargets(templateId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (targetIds: string[]) => assignTrackerTargets(templateId, targetIds),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useSaveTrackerBatch() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (edits: TrackerBatchEdit[]) => saveTrackerBatch(edits),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useSaveTrackerBatchOnBehalf() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ reason, edits }: { reason: string; edits: TrackerBatchEdit[] }) =>
      saveTrackerBatchOnBehalf(reason, edits),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useRaiseTrackerBlocker() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ recordId, text }: { recordId: string; text: string }) => raiseTrackerBlocker(recordId, text),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useClearTrackerBlocker() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (blockerId: string) => clearTrackerBlocker(blockerId),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useUpdateTrackerTemplate(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (patch: TrackerTemplatePatch) => updateTrackerTemplate(id, patch),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useUpdateTrackerField(templateId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ fieldId, patch }: { fieldId: string; patch: TrackerFieldPatch }) => updateTrackerField(templateId, fieldId, patch),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useDeleteTrackerField(templateId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (fieldId: string) => deleteTrackerField(templateId, fieldId),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useDeleteTrackerTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteTrackerTemplate(id),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useTrackerProofs(recordId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.trackerProofs(recordId ?? ''),
    queryFn: () => getTrackerProofs(recordId as string),
    enabled: Boolean(recordId) && enabled,
    staleTime: 15_000,
  });
}

export function useUploadProofPhoto(recordId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (file: Blob) => uploadProofPhoto(recordId, file),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useCaptureProofLocation(recordId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { lat: number; lng: number; accuracy_m?: number }) => captureProofLocation(recordId, body),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useDeleteProofPhoto(recordId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (proofId: string) => deleteProofPhoto(recordId, proofId),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useNudge() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { doerId: string; templateId?: string }) => nudgeTracker(v),
    onSuccess: () => invalidate('tracker'),
  });
}

// --- Additional Student Details --------------------------------------------

export function useStudentFields(status?: TrackerStudentFieldStatus, enabled = true) {
  return useQuery({
    queryKey: qk.trackerStudentFields(status),
    queryFn: () => listStudentFields(status),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateStudentField() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateStudentFieldInput) => createStudentField(input),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useUpdateStudentField() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StudentFieldPatch }) => updateStudentField(id, patch),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useDeleteStudentField() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteStudentField(id),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useStudentDetails(studentId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerStudentDetails(studentId ?? ''),
    queryFn: () => getStudentDetails(studentId as string),
    enabled: Boolean(studentId),
    staleTime: 30_000,
  });
}

export function useSaveStudentDetails(studentId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (values: Record<string, unknown>) => saveStudentDetails(studentId, values),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useProfilePaths(target: TrackerTargetType, enabled = true) {
  return useQuery({
    queryKey: qk.trackerProfilePaths(target),
    queryFn: () => listProfilePaths(target),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ── School-visit geo verification ─────────────────────────────────────────────

/** Verification state per school for a task's current period. */
export function useTemplateGeoVerifications(
  templateId: string | undefined,
  enabled = true,
  periodKey?: string,
) {
  return useQuery({
    queryKey: qk.trackerGeo(templateId ?? '', periodKey ?? 'current'),
    queryFn: () => getTemplateGeoVerifications(templateId as string, periodKey),
    enabled: Boolean(templateId) && enabled,
    staleTime: 15_000,
  });
}

/** The shared verification a specific row consumes — used by the History drawer. */
export function useRecordGeoVerification(recordId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.trackerRecordGeo(recordId ?? ''),
    queryFn: () => getRecordGeoVerification(recordId as string),
    enabled: Boolean(recordId) && enabled,
    staleTime: 15_000,
  });
}

export function useUploadGeoVerification(templateId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ schoolId, file }: { schoolId: string; file: File }) =>
      uploadGeoVerification(templateId, schoolId, file),
    onSuccess: () => invalidate('tracker'),
  });
}

export function useOverrideGeoVerification() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ verificationId, reason }: { verificationId: string; reason: string }) =>
      overrideGeoVerification(verificationId, reason),
    onSuccess: () => invalidate('tracker'),
  });
}

/**
 * One page of a recurring task's earlier periods.
 *
 * Paged rather than fetched whole: a daily task accumulates a row per day forever,
 * and the UI only shows the previous period until the user asks for more.
 */
export function useRecordPeriodHistory(
  recordId: string | undefined,
  enabled = true,
  before?: string,
  limit = 5,
  /** Set on a student profile: reads the same history through the student-scoped route. */
  studentId?: string,
) {
  return useQuery({
    queryKey: qk.trackerPeriods(recordId ?? '', before ?? 'latest', studentId ?? 'record'),
    queryFn: () => getRecordPeriodHistory(recordId as string, limit, before, studentId),
    enabled: Boolean(recordId) && enabled,
    staleTime: 30_000,
  });
}

/** Every tracker row recorded about one student — the student-profile cut of the tracker. */
export function useStudentTrackerTasks(studentId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerStudentTasks(studentId ?? ''),
    queryFn: () => getStudentTrackerTasks(studentId as string),
    enabled: Boolean(studentId),
    staleTime: 30_000,
    // A profile viewer without tracker.view gets a 403, and no amount of retrying
    // will grant it — but a network blip or a 5xx deserves the normal retries, so
    // only the permission answer short-circuits.
    retry: (failureCount, error) =>
      (error as { status?: number } | null)?.status === 403 ? false : failureCount < 3,
  });
}

/** Every deadline extension on a record, newest first. */
export function useRecordExtensions(recordId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.trackerExtensions(recordId ?? ''),
    queryFn: () => getRecordExtensions(recordId as string),
    enabled: Boolean(recordId) && enabled,
    staleTime: 15_000,
  });
}

export function useGrantExtension() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ recordId, extended_to, reason }: { recordId: string; extended_to: string; reason: string }) =>
      grantExtension(recordId, extended_to, reason),
    onSuccess: () => invalidate('tracker'),
  });
}
