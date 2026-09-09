"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { activeFilterCount, isActive, type FilterDef, type FilterState } from "./spec";
import { readFilterState, writeFilterParams } from "./url";

/**
 * Spec-driven filter state, held in the URL.
 *
 * This generalizes app/dashboard/attendance/_components/useRecordsFilters.ts, which
 * proved the pattern on the attendance Records tab: a report you cannot send to the
 * person who must act on it is doing half its job.
 *
 * `replace` rather than `push`: filtering is not navigation, and a filter row that
 * stuffs twenty entries into history makes Back useless. Navigation params the spec
 * does not own — the tracker's `?task=`, `?tab=`, `?owner=`, and the repo-wide
 * `?from=` — are carried through untouched.
 */
export function useUrlFilters<Row>(spec: FilterDef<Row>[]) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo(
    () => readFilterState(spec, new URLSearchParams(params.toString())),
    [spec, params],
  );

  const commit = useCallback((next: FilterState) => {
    const qs = writeFilterParams(spec, next, new URLSearchParams(params.toString()));
    // Any filter change invalidates the page cursor: page 3 of a different filter
    // shows an empty list and reads as "no results".
    qs.delete("page");
    const s = qs.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }, [spec, params, pathname, router]);

  const set = useCallback(
    (patch: FilterState) => commit({ ...state, ...patch }),
    [commit, state],
  );

  const clear = useCallback(() => commit({}), [commit]);

  return { state, set, clear, activeCount: activeFilterCount(spec as FilterDef<never>[], state) };
}

/**
 * The same shape, held in component state instead of the URL.
 *
 * For places a filterable list is embedded inside another view and does not own the
 * query string — a manager's drill-in, a task list rendered beside others. Sharing
 * the URL there would make two lists fight over `status`.
 */
export function useLocalFilters(): FilterControls {
  const [state, setState] = useState<FilterState>({});
  return {
    state,
    set: useCallback((patch: FilterState) => setState((prev) => ({ ...prev, ...patch })), []),
    clear: useCallback(() => setState({}), []),
    activeCount: Object.values(state).filter(isActive).length,
  };
}

export type FilterControls = {
  state: FilterState;
  set: (patch: FilterState) => void;
  clear: () => void;
  activeCount: number;
};
