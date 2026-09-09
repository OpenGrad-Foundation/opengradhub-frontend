import type { TrackerField, TrackerGridRow } from "@/lib/tracker-api";
import type { FilterDef, RangeValue } from "./spec";

/**
 * Filter definitions derived from a task's OWN columns.
 *
 * Every template defines its own fields, so the grid's value filters cannot be
 * written ahead of time — they are built from `grid.columns` at render time, which
 * is why this works for a template authored tomorrow.
 *
 * Matching reads `row.cells`, the resolved view the server projects, NOT the raw
 * `values` JSONB. That is deliberate: a `source: 'profile'` column (a student's
 * class, read live from their record) has no entry in `values` at all, and filtering
 * the raw object would silently ignore exactly the columns people most want to slice
 * by. It is also why grid filtering runs in the browser — see the spec's "Cutover".
 */

/**
 * The "no answer" option.
 *
 * Values are encoded rather than compared bare (`v:Yes` for a real value, this token
 * for emptiness) because a template may legitimately define an option whose text is
 * anything at all — including this token. Encoding keeps the sentinel outside the
 * value space instead of hoping no one picks it.
 */
export const EMPTY_TOKEN = "__empty";
const encode = (value: string): string => `v:${value}`;
const decode = (raw: string): { empty: true } | { empty: false; value: string } =>
  raw === EMPTY_TOKEN ? { empty: true } : { empty: false, value: raw.startsWith("v:") ? raw.slice(2) : raw };

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** The resolved cell for a column, or undefined when `visible_if` hid it. */
function cellValue(row: TrackerGridRow, fieldKey: string): { present: boolean; value: unknown } {
  const cell = row.cells.find((c) => c.field_key === fieldKey);
  return cell ? { present: true, value: cell.value } : { present: false, value: undefined };
}

function matchScalar(field: TrackerField, row: TrackerGridRow, raw: string): boolean {
  const { present, value } = cellValue(row, field.field_key);
  // A hidden conditional column is not an empty answer — the question never applied.
  if (!present) return false;
  const wanted = decode(raw);
  if (wanted.empty) return isBlank(value);
  if (isBlank(value)) return false;

  switch (field.field_type) {
    case "multiselect":
      return Array.isArray(value) && value.map(String).includes(wanted.value);
    case "boolean":
      return String(value) === wanted.value;
    case "select":
      return String(value) === wanted.value;
    default:
      return String(value).toLowerCase().includes(wanted.value.toLowerCase());
  }
}

function matchRange(field: TrackerField, row: TrackerGridRow, range: RangeValue): boolean {
  const { present, value } = cellValue(row, field.field_key);
  if (!present || isBlank(value)) return false;
  if (field.field_type === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return false;
    if (range.from && n < Number(range.from)) return false;
    if (range.to && n > Number(range.to)) return false;
    return true;
  }
  // Dates are stored and compared as YYYY-MM-DD, which orders lexicographically.
  const d = String(value).slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

/**
 * One `FilterDef` per column. Keys are namespaced `f.<field_key>` so a field named
 * `q` or `status` cannot collide with a built-in filter of the same name.
 */
export function fieldFilterDefs(columns: TrackerField[]): FilterDef<TrackerGridRow>[] {
  return columns.map((field) => {
    const key = `f.${field.field_key}`;
    const base = { key, urlKey: key, apiKey: key, label: field.label };

    if (field.field_type === "number" || field.field_type === "date") {
      return {
        ...base,
        kind: field.field_type === "number" ? ("numrange" as const) : ("daterange" as const),
        match: (row: TrackerGridRow, value: NonNullable<unknown>) =>
          matchRange(field, row, value as RangeValue),
      };
    }

    const options = field.field_type === "boolean"
      ? [{ value: encode("true"), label: "Yes" }, { value: encode("false"), label: "No" }]
      : (field.options ?? []).map((o) => ({ value: encode(o), label: o }));

    return {
      ...base,
      kind: options.length ? ("select" as const) : ("text" as const),
      options: options.length ? [...options, { value: EMPTY_TOKEN, label: "(not filled)" }] : undefined,
      match: (row: TrackerGridRow, value: NonNullable<unknown>) =>
        matchScalar(field, row, String(value)),
    };
  });
}
