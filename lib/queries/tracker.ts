'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  assignTrackerTargets,
  clearTrackerBlocker,
  createTrackerTemplate,
  getTrackerGrid,
  getTrackerMineBlockers,
  getTrackerQueueBlockers,
  getTrackerSummary,
  getTrackerTemplate,
  getTrackerTemplates,
  raiseTrackerBlocker,
  saveTrackerBatch,
  type AddTrackerFieldsInput,
  type CreateTrackerTemplateInput,
  type TrackerBatchEdit,
  addTrackerFields,
} from '../tracker-api';
import { useInvalidate } from '../mutations/invalidation';
import { qk } from './keys';

export function useTrackerTemplates() {
  return useQuery({
    queryKey: qk.trackerTemplates(),
    queryFn: getTrackerTemplates,
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
