"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type RecordsView = "students" | "grid";

export type RecordsFilterState = {
  cohortType: "batch" | "course";
  cohortId: string;
  from: string;
  to: string;
  q: string;
  page: number;
  /** Which rendering of the same answer is on screen. */
  view: RecordsView;
  /** The student whose history is open, if any. */
  student: string;
};

export const DEFAULTS: RecordsFilterState = {
  cohortType: "batch",
  cohortId: "",
  from: "",
  to: "",
  q: "",
  page: 1,
  view: "students",
  student: "",
};

/**
 * Records keeps its filters in the URL, the way Live Classes already does.
 *
 * Without this, "batch X, 1–15 August" was unshareable, the browser Back button
 * did nothing after a filter change, and an open student history vanished on
 * reload. A report you cannot send to the person who needs to act on it is
 * doing half its job.
 *
 * Only NON-default values are written, so a bare `/dashboard/attendance` and a
 * fully defaulted one produce the same URL. `replace` rather than `push`:
 * filtering is not navigation. The one exception is the student drill-down,
 * which IS navigation — opening it pushes, so Back closes it.
 */
export function useRecordsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo<RecordsFilterState>(() => {
    const page = Number(params.get("page"));
    return {
      cohortType: params.get("cohort") === "course" ? "course" : "batch",
      cohortId: params.get("id") ?? "",
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
      q: params.get("q") ?? "",
      page: Number.isFinite(page) && page > 1 ? Math.floor(page) : 1,
      view: params.get("view") === "grid" ? "grid" : "students",
      student: params.get("student") ?? "",
    };
  }, [params]);

  const write = useCallback(
    (patch: Partial<RecordsFilterState>, mode: "replace" | "push") => {
      const next = { ...state, ...patch };
      const qs = new URLSearchParams(params.toString());
      const put = (key: string, value: string, isDefault: boolean) =>
        isDefault ? qs.delete(key) : qs.set(key, value);

      put("cohort", next.cohortType, next.cohortType === DEFAULTS.cohortType);
      put("id", next.cohortId, next.cohortId === "");
      put("from", next.from, next.from === "");
      put("to", next.to, next.to === "");
      put("q", next.q, next.q.trim() === "");
      put("page", String(next.page), next.page <= 1);
      put("view", next.view, next.view === DEFAULTS.view);
      put("student", next.student, next.student === "");

      const s = qs.toString();
      const url = s ? `${pathname}?${s}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [state, params, pathname, router],
  );

  /** Any filter change resets paging: page 3 of a different cohort is nonsense. */
  const set = useCallback(
    (patch: Partial<RecordsFilterState>) => {
      const resetsPage = ["cohortType", "cohortId", "from", "to", "q"].some((k) => k in patch);
      write(resetsPage ? { page: 1, ...patch } : patch, "replace");
    },
    [write],
  );

  const openStudent = useCallback((id: string) => write({ student: id }, "push"), [write]);
  const closeStudent = useCallback(() => {
    // Back is the natural gesture for closing something Back opened.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else write({ student: "" }, "replace");
  }, [router, write]);

  return { state, set, openStudent, closeStudent };
}
