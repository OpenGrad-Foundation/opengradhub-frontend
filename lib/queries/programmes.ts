'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getAssignableBatches,
  getAssignableContent,
  getEligibleProgrammeMembers,
  getProgramme,
  getProgrammeBatches,
  getProgrammeContent,
  getProgrammeMembers,
  getProgrammeSchools,
  getProgrammes,
  type ProgrammeContentKind,
} from '../api';
import { qk } from './keys';

/**
 * Programme container reads.
 *
 * Memory-only, deliberately NOT IDB-persisted. Every response here is
 * per-caller — the list is filtered by membership and each row carries
 * `my_level` — so persisting it to IndexedDB would survive a logout and could
 * be read by the next account on a shared device. The backend marks these
 * routes @NoStore for the same reason.
 *
 * Short staleTime because these views are mutation-heavy: you add a member and
 * immediately look at the list you just changed.
 */

export function useProgrammes(includeArchived = false) {
  return useQuery({
    queryKey: qk.programmes(includeArchived),
    queryFn: () => getProgrammes(includeArchived),
    staleTime: 60_000,
  });
}

export function useProgramme(id: string | undefined) {
  return useQuery({
    queryKey: qk.programme(id ?? ''),
    queryFn: () => getProgramme(id as string),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useProgrammeMembers(id: string | undefined) {
  return useQuery({
    queryKey: qk.programmeMembers(id ?? ''),
    queryFn: () => getProgrammeMembers(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/**
 * Only fetched when the caller may actually staff the programme — the endpoint
 * requires ownership, so firing it for a VIEWER would be a guaranteed 403.
 */
export function useEligibleProgrammeMembers(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.programmeEligibleMembers(id ?? ''),
    queryFn: () => getEligibleProgrammeMembers(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  });
}

export function useProgrammeSchools(id: string | undefined) {
  return useQuery({
    queryKey: qk.programmeSchools(id ?? ''),
    queryFn: () => getProgrammeSchools(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useProgrammeContent(id: string | undefined) {
  return useQuery({
    queryKey: qk.programmeContent(id ?? ''),
    queryFn: () => getProgrammeContent(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/**
 * The assignable picker. `enabled` is caller-controlled because this route
 * requires programmes.edit AND ownership — mounting it for a VIEWER would fire
 * a guaranteed 403 on every render of the page.
 */
export function useAssignableContent(
  id: string | undefined,
  kind: ProgrammeContentKind,
  q: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: qk.programmeAssignable(id ?? '', kind, q),
    queryFn: () => getAssignableContent(id as string, kind, q),
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  });
}

export function useProgrammeBatches(id: string | undefined) {
  return useQuery({
    queryKey: qk.programmeBatches(id ?? ''),
    queryFn: () => getProgrammeBatches(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

/** Owner-only route — `enabled` keeps a VIEWER from firing a guaranteed 403. */
export function useAssignableBatches(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.programmeAssignableBatches(id ?? ''),
    queryFn: () => getAssignableBatches(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 15_000,
  });
}
