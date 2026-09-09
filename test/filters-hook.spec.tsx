import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUrlFilters } from "@/lib/filters/use-url-filters";
import type { FilterDef } from "@/lib/filters";

/**
 * The hook that puts filter state in the URL. It must behave the way the
 * attendance Records filters already do: replace rather than push (filtering is
 * not navigation), defaults omitted, and paging reset on any filter change.
 */

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard/tracker",
  useSearchParams: () => new URLSearchParams(search),
}));

const SPEC: FilterDef<unknown>[] = [
  { key: "q", urlKey: "q", apiKey: "q", label: "Search", kind: "text" },
  { key: "due", urlKey: "due", apiKey: "due", label: "Due", kind: "daterange" },
];

beforeEach(() => { replace.mockClear(); search = ""; });

describe("useUrlFilters", () => {
  it("reads initial state out of the URL", () => {
    search = "q=asha";
    const { result } = renderHook(() => useUrlFilters(SPEC));
    expect(result.current.state.q).toBe("asha");
  });

  it("replaces rather than pushes, so Back leaves the tracker", () => {
    const { result } = renderHook(() => useUrlFilters(SPEC));
    act(() => result.current.set({ q: "asha" }));
    expect(replace).toHaveBeenCalledWith("/dashboard/tracker?q=asha", { scroll: false });
  });

  it("keeps the page path clean when every filter is cleared", () => {
    search = "q=asha";
    const { result } = renderHook(() => useUrlFilters(SPEC));
    act(() => result.current.clear());
    expect(replace).toHaveBeenCalledWith("/dashboard/tracker", { scroll: false });
  });

  it("preserves the tracker's ?task= deep link and the back-nav ?from=", () => {
    search = "task=t1&from=%2Fdashboard%2Fschools";
    const { result } = renderHook(() => useUrlFilters(SPEC));
    act(() => result.current.set({ q: "asha" }));
    const url = replace.mock.calls[0][0] as string;
    expect(url).toContain("task=t1");
    expect(url).toContain("from=%2Fdashboard%2Fschools");
  });

  it("clearing filters leaves navigation params alone", () => {
    search = "task=t1&q=asha";
    const { result } = renderHook(() => useUrlFilters(SPEC));
    act(() => result.current.clear());
    expect(replace).toHaveBeenCalledWith("/dashboard/tracker?task=t1", { scroll: false });
  });

  it("resets page on a filter change, since page 3 of a different filter is nonsense", () => {
    search = "page=3";
    const { result } = renderHook(() => useUrlFilters(SPEC));
    act(() => result.current.set({ q: "asha" }));
    expect(replace.mock.calls[0][0]).not.toContain("page=3");
  });

  it("counts active filters for the clear-all affordance", () => {
    search = "q=asha&due_from=2026-08-01";
    const { result } = renderHook(() => useUrlFilters(SPEC));
    expect(result.current.activeCount).toBe(2);
  });
});
