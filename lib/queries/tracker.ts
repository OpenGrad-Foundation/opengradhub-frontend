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
  addBlockerComment,
  getBlockerThread,
  getTrackerFellows,
  getTrackerFellowTasks,
  getTrackerMyTasks,
  getTrackerOverview,
  getTrackerRecordHistory,
  getTrackerSummary,
  getTrackerTemplate,
  getTrackerTemplates,
  raiseTrackerBlocker,
  saveTrackerBatch,
  updateTrackerTemplate,
  updateTrackerField,
  deleteTrackerField,
  deleteTrackerTemplate,
  getTrackerProofs,
  uploadProofPhoto,
  captureProofLocation,
  deleteProofPhoto,
  type AddTrackerFieldsInput,
  type CreateTrackerTemplateInput,
  type TrackerBatchEdit,
  type TrackerTargetType,
  type TrackerTemplatePatch,
  type TrackerFieldPatch,
  addTrackerFields,
} from '../tracker-api';
import { useInvalidate } from '../mutations/invalidation';
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

export function useTrackerGrid(templateId: string | undefined) {
  return useQuery({
    queryKey: qk.trackerGrid(templateId ?? ''),
    queryFn: () => getTrackerGrid(templateId as string),
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

export function useTrackerAssignable(targetType: TrackerTargetType, enabled = true) {
  return useQuery({
    queryKey: qk.trackerAssignable(targetType),
    queryFn: () => getTrackerAssignable(targetType),
    enabled,
    staleTime: 60_000,
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
