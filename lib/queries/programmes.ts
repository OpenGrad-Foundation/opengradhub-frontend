'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getAssignableBatches,
  getAssignableContent,
  getEligibleProgrammeMembers,
  getEligibleProgrammeStudents,
  getProgramme,
  getProgrammeBatches,
  getProgrammeContent,
  getProgrammeMembers,
  getProgrammeSchools,
  getProgrammeOverview,
  getProgrammeStudents,
  type ProgrammeStudentQuery,
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

export function useProgrammes(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: qk.programmes(includeArchived),
    queryFn: () => getProgrammes(includeArchived),
    enabled,
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

/** Hub Analytics tab. Lazily enabled so the counts are not fetched unread. */
export function useProgrammeOverview(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.programmeOverview(id ?? ''),
    queryFn: () => getProgrammeOverview(id as string),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  });
}

/**
 * The programme's student roster. Lazily enabled by the hub so opening the page
 * does not fetch a roster nobody looked at.
 */
export function useProgrammeStudents(
  id: string | undefined,
  enabled = true,
  query: ProgrammeStudentQuery = {},
) {
  return useQuery({
    // The filters are part of the key: server-side filtering means each
    // combination is a different response, and sharing one key would serve a
    // filtered roster as the unfiltered one.
    queryKey: [...qk.programmeStudents(id ?? ''), query],
    queryFn: () => getProgrammeStudents(id as string, query),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
    // Keeps the previous page on screen while a keystroke's query is in flight,
    // instead of blanking the table on every character typed.
    placeholderData: (prev) => prev,
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

/**
 * Assignable students, searched on the server. Keyed by query so each needle is
 * its own cache entry; only fetched while the picker is open, because the
 * endpoint requires programme administration and would 403 for a plain viewer.
 */
export function useEligibleProgrammeStudents(id: string | undefined, q: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.programmeEligibleStudents(id ?? '', q),
    queryFn: () => getEligibleProgrammeStudents(id as string, q),
    enabled: Boolean(id) && enabled,
    placeholderData: (prev) => prev,
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
