import { describe, it, expect } from "vitest";
import { fieldFilterDefs, EMPTY_TOKEN } from "@/lib/filters/field-spec";
import { applyFilters } from "@/lib/filters";
import type { TrackerField, TrackerGridRow } from "@/lib/tracker-api";

/**
 * Filtering a task's grid by the ANSWERS in it.
 *
 * The defs are derived from the template's own columns, so this works for any
 * template without per-template code. Three rules carry the weight:
 *
 *   - matching reads `row.cells`, the RESOLVED view, so a profile-sourced column
 *     (a student's class, pulled live from their record) filters like a typed answer;
 *   - a column hidden by `visible_if` has no cell, and its row is excluded rather
 *     than counted as an empty answer;
 *   - the empty sentinel is encoded, so a select option may legitimately be the
 *     literal string the sentinel uses.
 */

const field = (over: Partial<TrackerField>): TrackerField => ({
  field_key: "f1", label: "Field", field_type: "text", options: null,
  source: "input", source_path: null, required: false, visible_if: null, sort_order: 0,
  ...over,
} as TrackerField);

const row = (cells: Array<{ field_key: string; value: unknown }>): TrackerGridRow => ({
  record_id: Math.random().toString(36).slice(2),
  status: "not_started",
  cells: cells.map((c) => ({ field_key: c.field_key, label: c.field_key, value: c.value, locked: false, notSet: false })),
  blocked: false, blocker: null, school_name: null, target_name: null, lifecycle: "not_started",
});

const defsFor = (cols: TrackerField[]) => fieldFilterDefs(cols);

describe("select fields", () => {
  const cols = [field({ field_key: "enrol", field_type: "select", options: ["Yes", "No"] })];

  it("matches on the chosen option", () => {
    const rows = [row([{ field_key: "enrol", value: "Yes" }]), row([{ field_key: "enrol", value: "No" }])];
    const out = applyFilters(rows, defsFor(cols), { "f.enrol": `v:Yes` });
    expect(out).toHaveLength(1);
    expect(out[0].cells[0].value).toBe("Yes");
  });

  it("finds rows with no answer via the empty sentinel", () => {
    const rows = [row([{ field_key: "enrol", value: "Yes" }]), row([{ field_key: "enrol", value: null }])];
    expect(applyFilters(rows, defsFor(cols), { "f.enrol": EMPTY_TOKEN })).toHaveLength(1);
  });

  it("does not confuse an option that looks like the sentinel with emptiness", () => {
    const literal = [field({ field_key: "enrol", field_type: "select", options: [EMPTY_TOKEN, "No"] })];
    const rows = [row([{ field_key: "enrol", value: EMPTY_TOKEN }]), row([{ field_key: "enrol", value: null }])];
    const matched = applyFilters(rows, defsFor(literal), { "f.enrol": `v:${EMPTY_TOKEN}` });
    expect(matched).toHaveLength(1);
    expect(matched[0].cells[0].value).toBe(EMPTY_TOKEN);
  });
});

describe("other field types", () => {
  it("matches a multiselect when the row's list contains the option", () => {
    const cols = [field({ field_key: "subj", field_type: "multiselect", options: ["Maths", "Science"] })];
    const rows = [row([{ field_key: "subj", value: ["Maths", "Science"] }]), row([{ field_key: "subj", value: ["Science"] }])];
    expect(applyFilters(rows, defsFor(cols), { "f.subj": "v:Maths" })).toHaveLength(1);
  });

  it("matches booleans, including false", () => {
    const cols = [field({ field_key: "ok", field_type: "boolean" })];
    const rows = [row([{ field_key: "ok", value: true }]), row([{ field_key: "ok", value: false }])];
    expect(applyFilters(rows, defsFor(cols), { "f.ok": "v:false" })).toHaveLength(1);
  });

  it("matches a number range inclusively", () => {
    const cols = [field({ field_key: "n", field_type: "number" })];
    const rows = [row([{ field_key: "n", value: 5 }]), row([{ field_key: "n", value: 50 }])];
    expect(applyFilters(rows, defsFor(cols), { "f.n": { from: "1", to: "10" } })).toHaveLength(1);
  });

  it("matches text case-insensitively, on a substring", () => {
    const cols = [field({ field_key: "note", field_type: "text" })];
    const rows = [row([{ field_key: "note", value: "Visited HOME" }]), row([{ field_key: "note", value: "Called" }])];
    expect(applyFilters(rows, defsFor(cols), { "f.note": "v:home" })).toHaveLength(1);
  });

  it("matches a date range inclusively", () => {
    const cols = [field({ field_key: "d", field_type: "date" })];
    const rows = [row([{ field_key: "d", value: "2026-08-10" }]), row([{ field_key: "d", value: "2026-09-10" }])];
    expect(applyFilters(rows, defsFor(cols), { "f.d": { from: "2026-08-01", to: "2026-08-31" } })).toHaveLength(1);
  });
});

describe("conditional fields", () => {
  it("excludes a row where the filtered field is not shown at all", () => {
    // The cell is absent because visible_if hid it — a question that never applied
    // is not an unanswered question, so the row is not a match either way.
    const cols = [field({ field_key: "why", field_type: "text" })];
    const rows = [row([{ field_key: "why", value: "late bus" }]), row([{ field_key: "other", value: "x" }])];
    expect(applyFilters(rows, defsFor(cols), { "f.why": "v:late" })).toHaveLength(1);
    expect(applyFilters(rows, defsFor(cols), { "f.why": EMPTY_TOKEN })).toHaveLength(0);
  });
});

describe("spec derivation", () => {
  it("builds one def per column, keyed so it cannot collide with a built-in filter", () => {
    const cols = [field({ field_key: "q" }), field({ field_key: "status" })];
    expect(defsFor(cols).map((d) => d.key)).toEqual(["f.q", "f.status"]);
    expect(defsFor(cols).map((d) => d.urlKey)).toEqual(["f.q", "f.status"]);
  });

  it("offers the template's own options on a select", () => {
    const cols = [field({ field_key: "enrol", field_type: "select", options: ["Yes", "No"] })];
    expect(defsFor(cols)[0].options?.map((o) => o.value)).toEqual(["v:Yes", "v:No", EMPTY_TOKEN]);
  });
});
