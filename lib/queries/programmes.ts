'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getProgramme,
  getProgrammeMembers,
  getProgrammeSchools,
  getProgrammes,
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

export function useProgrammeSchools(id: string | undefined) {
  return useQuery({
    queryKey: qk.programmeSchools(id ?? ''),
    queryFn: () => getProgrammeSchools(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}
