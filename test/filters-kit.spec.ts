import { describe, it, expect } from "vitest";
import {
  applyFilters, toQuery, readFilterState, writeFilterParams, activeFilterCount,
  type FilterDef, type FilterState,
} from "@/lib/filters";

/**
 * The filter kit's two executors and its URL codec.
 *
 * The kit exists so four tracker surfaces stop each inventing their own filter row.
 * Everything here is surface-agnostic: a spec goes in, matching rows or request
 * params come out, and the URL is the single place the state lives.
 */

type Row = { name: string; school_id: string | null; due: string | null; missing: boolean };

const ROWS: Row[] = [
  { name: "Asha", school_id: "s1", due: "2026-08-01", missing: true },
  { name: "Bala", school_id: "s2", due: "2026-08-20", missing: false },
  { name: "Chitra", school_id: null, due: null, missing: true },
];

const SPEC: FilterDef<Row>[] = [
  { key: "q", urlKey: "q", apiKey: "q", label: "Search", kind: "text",
    match: (r, v) => r.name.toLowerCase().includes(String(v).toLowerCase()) },
  { key: "school", urlKey: "school", apiKey: "schoolId", label: "School", kind: "select",
    match: (r, v) => r.school_id === v },
  { key: "due", urlKey: "due", apiKey: "due", label: "Due", kind: "daterange",
    match: (r, v) => {
      const { from, to } = v as { from?: string; to?: string };
      if (!r.due) return false;
      return (!from || r.due >= from) && (!to || r.due <= to);
    } },
  { key: "noproof", urlKey: "noproof", apiKey: "noProof", label: "Missing proof", kind: "toggle",
    match: (r) => r.missing },
];

const params = (s: string) => new URLSearchParams(s);

describe("readFilterState", () => {
  it("reads scalar, range and toggle params", () => {
    const s = readFilterState(SPEC, params("q=as&school=s1&due_from=2026-08-01&due_to=2026-08-31&noproof=1"));
    expect(s.q).toBe("as");
    expect(s.school).toBe("s1");
    expect(s.due).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(s.noproof).toBe(true);
  });

  it("returns an empty state for a bare URL", () => {
    expect(readFilterState(SPEC, params(""))).toEqual({});
  });

  it("reads one end of a range independently", () => {
    expect(readFilterState(SPEC, params("due_to=2026-08-10")).due).toEqual({ to: "2026-08-10" });
  });

  it("ignores params that belong to no def, so an unrelated key survives untouched", () => {
    const s = readFilterState(SPEC, params("task=abc&from=%2Fdashboard&mystery=1"));
    expect(s).toEqual({});
  });
});

describe("writeFilterParams", () => {
  it("omits defaults, so a cleared filter leaves no trace in the URL", () => {
    const qs = writeFilterParams(SPEC, {}, params(""));
    expect(qs.toString()).toBe("");
  });

  it("round-trips every kind", () => {
    const state: FilterState = { q: "as", school: "s1", due: { from: "2026-08-01" }, noproof: true };
    const qs = writeFilterParams(SPEC, state, params(""));
    expect(readFilterState(SPEC, qs)).toEqual(state);
  });

  it("preserves navigation params it does not own", () => {
    // `task` is the tracker's existing deep link and `from` is the repo-wide back-nav
    // key; a filter change must never clobber either.
    const qs = writeFilterParams(SPEC, { q: "as" }, params("task=t1&from=%2Fdashboard"));
    expect(qs.get("task")).toBe("t1");
    expect(qs.get("from")).toBe("/dashboard");
    expect(qs.get("q")).toBe("as");
  });

  it("clears a range's both ends when the filter is removed", () => {
    const qs = writeFilterParams(SPEC, {}, params("due_from=2026-08-01&due_to=2026-08-31"));
    expect(qs.get("due_from")).toBeNull();
    expect(qs.get("due_to")).toBeNull();
  });

  it("drops a toggle rather than writing 0", () => {
    const qs = writeFilterParams(SPEC, { noproof: false }, params("noproof=1"));
    expect(qs.get("noproof")).toBeNull();
  });

  it("trims a whitespace-only text filter to nothing", () => {
    expect(writeFilterParams(SPEC, { q: "   " }, params("")).toString()).toBe("");
  });
});

describe("applyFilters", () => {
  it("returns every row when nothing is active", () => {
    expect(applyFilters(ROWS, SPEC, {})).toHaveLength(3);
  });

  it("ANDs active filters", () => {
    expect(applyFilters(ROWS, SPEC, { q: "a", school: "s1" }).map((r) => r.name)).toEqual(["Asha"]);
  });

  it("applies a toggle only when true", () => {
    expect(applyFilters(ROWS, SPEC, { noproof: true }).map((r) => r.name)).toEqual(["Asha", "Chitra"]);
    expect(applyFilters(ROWS, SPEC, { noproof: false })).toHaveLength(3);
  });

  it("treats a range with neither end as inactive", () => {
    expect(applyFilters(ROWS, SPEC, { due: {} })).toHaveLength(3);
  });

  it("excludes rows the range cannot answer for", () => {
    const out = applyFilters(ROWS, SPEC, { due: { from: "2026-08-01", to: "2026-08-05" } });
    expect(out.map((r) => r.name)).toEqual(["Asha"]);
  });

  it("skips a def with no matcher instead of dropping every row", () => {
    const serverOnly: FilterDef<Row>[] = [
      { key: "zm", urlKey: "zm", apiKey: "zmId", label: "ZM", kind: "select" },
    ];
    expect(applyFilters(ROWS, serverOnly, { zm: "z1" })).toHaveLength(3);
  });
});

describe("toQuery", () => {
  it("maps URL vocabulary to API vocabulary", () => {
    const q = toQuery(SPEC, { school: "s1", noproof: true });
    expect(q).toEqual({ schoolId: "s1", noProof: true });
  });

  it("expands a range into two suffixed API keys", () => {
    expect(toQuery(SPEC, { due: { from: "2026-08-01", to: "2026-08-31" } }))
      .toEqual({ dueFrom: "2026-08-01", dueTo: "2026-08-31" });
  });

  it("omits inactive and empty values", () => {
    expect(toQuery(SPEC, { q: "  ", school: "", noproof: false, due: {} })).toEqual({});
  });
});

describe("activeFilterCount", () => {
  it("counts one per active def, a range being one", () => {
    expect(activeFilterCount(SPEC, { q: "a", due: { from: "x", to: "y" }, noproof: true })).toBe(3);
  });

  it("ignores empty values", () => {
    expect(activeFilterCount(SPEC, { q: "", school: "", due: {}, noproof: false })).toBe(0);
  });
});
