"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LiveClassFilters } from "@/lib/api";

export type ClassFilterState = {
  view: "upcoming" | "past";
  q: string;
  /** `course:<id>` | `batch:<id>`, or "" for no filter. */
  audience: string;
  archived: boolean;
};

export const DEFAULTS: ClassFilterState = {
  view: "upcoming",
  q: "",
  audience: "",
  archived: false,
};

/**
 * The Live Classes filter bar keeps its state in the URL, so a filtered list is
 * linkable and survives a reload.
 *
 * Only NON-default values are written, which is what keeps a bare
 * `/dashboard/live-classes` and a fully defaulted one rendering the same list.
 * `router.replace` rather than `push`: filtering is not navigation, and pushing
 * would bury the previous page under a stack of filter states.
 */
export function useClassFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const state = useMemo<ClassFilterState>(() => {
    const view = params.get("view");
    return {
      view: view === "past" ? "past" : "upcoming",
      q: params.get("q") ?? "",
      audience: params.get("audience") ?? "",
      archived: params.get("archived") === "1",
    };
  }, [params]);

  const set = useCallback(
    (patch: Partial<ClassFilterState>) => {
      const next = { ...state, ...patch };
      const qs = new URLSearchParams(params.toString());
      const write = (key: string, value: string, isDefault: boolean) => {
        if (isDefault) qs.delete(key);
        else qs.set(key, value);
      };
      write("view", next.view, next.view === DEFAULTS.view);
      write("q", next.q, next.q.trim() === "");
      write("audience", next.audience, next.audience === "");
      write("archived", "1", !next.archived);
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [state, params, pathname, router],
  );

  /** The filter state as the API wants it. */
  const apiFilters = useMemo<LiveClassFilters>(() => {
    const [type, id] = state.audience.split(":");
    return {
      view: state.view,
      q: state.q.trim() || undefined,
      ...(type && id ? { audience_type: type as "course" | "batch", audience_id: id } : {}),
      include_archived: state.archived,
    };
  }, [state]);

  return { state, set, apiFilters };
}
