import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * The Live Classes filter bar keeps its state in the URL, so a filtered list is
 * linkable. The invariant that matters: only NON-default values are written, so
 * a bare `/dashboard/live-classes` and a fully defaulted one are the same URL —
 * and a bare API call stays bare, which the School confirmations tab and the
 * class edit page both depend on.
 */

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/live-classes",
  useSearchParams: () => new URLSearchParams(search),
}));

import { useClassFilters } from "@/app/dashboard/live-classes/_components/useClassFilters";

beforeEach(() => {
  replace.mockReset();
  search = "";
});

describe("useClassFilters — reading the URL", () => {
  it("defaults to upcoming with no search, audience or archived", () => {
    const { result } = renderHook(() => useClassFilters());
    expect(result.current.state).toEqual({ view: "upcoming", q: "", audience: "", archived: false });
  });

  it("hydrates every control from the query string", () => {
    search = "view=past&q=algebra&audience=batch:b-1&archived=1";
    const { result } = renderHook(() => useClassFilters());
    expect(result.current.state).toEqual({
      view: "past", q: "algebra", audience: "batch:b-1", archived: true,
    });
  });

  it("falls back to upcoming for an unknown view rather than rendering nothing", () => {
    search = "view=sideways";
    const { result } = renderHook(() => useClassFilters());
    expect(result.current.state.view).toBe("upcoming");
  });
});

describe("useClassFilters — writing the URL", () => {
  it("writes a non-default value", () => {
    const { result } = renderHook(() => useClassFilters());
    act(() => result.current.set({ view: "past" }));
    expect(replace).toHaveBeenCalledWith("/dashboard/live-classes?view=past", { scroll: false });
  });

  it("drops a param when it returns to its default, leaving a clean URL", () => {
    search = "view=past&archived=1";
    const { result } = renderHook(() => useClassFilters());
    act(() => result.current.set({ view: "upcoming", archived: false }));
    expect(replace).toHaveBeenCalledWith("/dashboard/live-classes", { scroll: false });
  });

  it("keeps unrelated query params", () => {
    search = "from=management";
    const { result } = renderHook(() => useClassFilters());
    act(() => result.current.set({ q: "algebra" }));
    const [url] = replace.mock.calls[0];
    expect(url).toContain("from=management");
    expect(url).toContain("q=algebra");
  });
});

describe("useClassFilters — what the API is asked for", () => {
  it("sends the page defaults explicitly, so archived stays hidden", () => {
    const { result } = renderHook(() => useClassFilters());
    expect(result.current.apiFilters).toEqual({
      view: "upcoming", q: undefined, include_archived: false,
    });
  });

  it("splits the audience into a type and an id", () => {
    search = "audience=course:c-9";
    const { result } = renderHook(() => useClassFilters());
    expect(result.current.apiFilters).toMatchObject({
      audience_type: "course", audience_id: "c-9",
    });
  });

  it("sends no audience filter when none is picked", () => {
    const { result } = renderHook(() => useClassFilters());
    expect(result.current.apiFilters.audience_type).toBeUndefined();
    expect(result.current.apiFilters.audience_id).toBeUndefined();
  });
});
