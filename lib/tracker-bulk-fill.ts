/** Bulk-fill of a tracker task grid via a spreadsheet round-trip.
 *
 *  Download: the rows currently visible in the grid are written out with one column per
 *  editable field, already carrying whatever has been filled in so far. Upload: the same
 *  file comes back with the blanks completed and is replayed through the ordinary batch-save
 *  endpoint, so every write goes down the same validated, audited path as an inline edit.
 *
 *  The record_id column is what ties a spreadsheet row back to its record, so an upload is
 *  only ever accepted against a grid that still contains those rows.
 */
import type { TrackerCell, TrackerField, TrackerGridRow } from "./tracker-api";

/** Packs a multiselect's values into one cell. Mirrors MULTISELECT_CSV_DELIMITER on the
 *  backend, which refuses to let an option value contain this character. */
export const MULTI_DELIM = ";";

/** Columns that identify and describe a row. Written on export for the human filling the
 *  sheet, never sent back on upload. */
export const RECORD_ID_HEADER = "record_id";
export const CONTEXT_HEADERS = ["Name", "School", "Status"] as const;
/** Only present in the failed-rows export, carrying the reason a row was not saved. */
export const PROBLEM_HEADER = "Problem";

/** A spreadsheet big enough to exceed these is not a fellow's task list — it is a mistake or
 *  a hostile file. Both caps are checked before any row is materialised, because a small
 *  compressed workbook can expand into an enormous grid. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_ROWS = 5000;

export type SheetRow = Record<string, string>;

/** Editable fields, in grid order. Profile-sourced fields are projected from the target's
 *  record and are not user-writable, so they never become columns. */
export function editableFields(columns: TrackerField[]): TrackerField[] {
  return columns.filter((c) => c.source !== "profile");
}

const FORMULA_START = /^[=+\-@\t\r]/;

/** A leading =, +, -, @ (or a control char Excel folds into one) makes a spreadsheet treat a
 *  value as a formula when the file is opened. Prefixing with an apostrophe keeps it literal.
 *  Applied to every cell of every file this module writes, the failed-rows export included. */
export function escapeSpreadsheetValue(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** Undoes escapeSpreadsheetValue on the way back in. Without this a file that was downloaded
 *  and re-uploaded untouched would not round-trip: -5 comes back as '-5, which is neither the
 *  same text nor a valid number.
 *
 *  Only an apostrophe that is actually shielding a formula character is removed, so ordinary
 *  text that happens to start with one is left alone. A stored value of literally '=x is the
 *  one case this cannot tell apart, and it resolves to =x. */
export function unescapeSpreadsheetValue(value: string): string {
  return value.startsWith("'") && FORMULA_START.test(value.slice(1)) ? value.slice(1) : value;
}

/** Renders a stored value into its spreadsheet cell text. The inverse of parseCellValue. */
export function serializeCellValue(field: TrackerField, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (field.field_type) {
    case "boolean":
      return value === true ? "true" : value === false ? "false" : "";
    case "multiselect":
      return Array.isArray(value) ? value.join(MULTI_DELIM) : "";
    default:
      return String(value);
  }
}

/** Turns the visible grid rows into flat objects ready to be written to a sheet.
 *
 *  A field hidden on a given row by a `visible_if` rule has no cell there, and is left blank
 *  rather than being invented — the upload side likewise refuses to write a field a row does
 *  not currently show. */
export function buildExportRows(columns: TrackerField[], rows: TrackerGridRow[]): SheetRow[] {
  const fields = editableFields(columns);
  const headers = headersByFieldKey(columns);
  return rows.map((row) => {
    const byKey = new Map(row.cells.map((c) => [c.field_key, c] as const));
    const out: SheetRow = {
      [RECORD_ID_HEADER]: row.record_id,
      Name: escapeSpreadsheetValue(row.target_name ?? ""),
      School: escapeSpreadsheetValue(row.school_name ?? ""),
      Status: escapeSpreadsheetValue(row.status ?? ""),
    };
    for (const f of fields) {
      const cell = byKey.get(f.field_key);
      out[headers.get(f.field_key)!] = cell ? escapeSpreadsheetValue(serializeCellValue(f, cell.value)) : "";
    }
    return out;
  });
}

/** The column heading a field is written under.
 *
 *  Normally the field's own label, which is what makes the sheet readable. A label that would
 *  otherwise be ambiguous — because another field shares it, or because it is one of the
 *  reserved columns — gets its field key appended, so every column still maps back to exactly
 *  one field. Export and import both go through here, so the two can never disagree. */
export function headersByFieldKey(columns: TrackerField[]): Map<string, string> {
  const fields = editableFields(columns);
  const counts = new Map<string, number>();
  for (const f of fields) counts.set(f.label, (counts.get(f.label) ?? 0) + 1);
  const reserved = new Set<string>([RECORD_ID_HEADER, ...CONTEXT_HEADERS, PROBLEM_HEADER]);

  const out = new Map<string, string>();
  for (const f of fields) {
    const needsKey = (counts.get(f.label) ?? 0) > 1 || reserved.has(f.label);
    out.set(f.field_key, needsKey ? `${f.label} [${f.field_key}]` : f.label);
  }
  return out;
}

/** Header order for the sheet. */
export function buildHeaders(columns: TrackerField[]): string[] {
  const headers = headersByFieldKey(columns);
  return [
    RECORD_ID_HEADER, ...CONTEXT_HEADERS,
    ...editableFields(columns).map((f) => headers.get(f.field_key)!),
  ];
}

/** Maps a sheet's column header back to the field it came from. */
export function fieldsByHeader(columns: TrackerField[]): Map<string, TrackerField> {
  const headers = headersByFieldKey(columns);
  return new Map(editableFields(columns).map((f) => [headers.get(f.field_key)!, f] as const));
}

/** Options that could not survive the round-trip, because a value contains the separator used
 *  to pack a multiselect into one cell. New options are refused at authoring time, but a task
 *  defined before that guard existed can still hold one, and silently splitting it would put
 *  values into a record that the task never offered. */
export function undelimitableOptions(columns: TrackerField[]): string[] {
  return editableFields(columns)
    .filter((f) => f.field_type === "multiselect")
    .flatMap((f) => (f.options ?? []).filter((o) => o.includes(MULTI_DELIM)).map((o) => `${f.label}: "${o}"`));
}

export type ParsedCell = { ok: true; value: unknown } | { ok: false; message: string };

const TRUE_WORDS = new Set(["true", "yes", "y", "1"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0"]);

function isValidCalendarDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [, y, mo, d] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return dt.getUTCFullYear() === Number(y)
    && dt.getUTCMonth() === Number(mo) - 1
    && dt.getUTCDate() === Number(d);
}

/** Converts one cell of sheet text into the value the API expects, applying the same rules the
 *  server enforces so a bad cell is caught in the preview instead of failing a whole batch.
 *  Callers handle blanks before getting here — a blank means "leave as it was", never "clear". */
export function parseCellValue(field: TrackerField, raw: string): ParsedCell {
  // Undo the export-side formula shield first, so a file that came straight back out of the
  // grid parses to the values it was built from.
  const text = unescapeSpreadsheetValue(raw).trim();
  switch (field.field_type) {
    case "boolean": {
      const lower = text.toLowerCase();
      if (TRUE_WORDS.has(lower)) return { ok: true, value: true };
      if (FALSE_WORDS.has(lower)) return { ok: true, value: false };
      return { ok: false, message: `${field.label} must be true or false` };
    }
    case "number": {
      if (Number.isNaN(Number(text))) return { ok: false, message: `${field.label} must be a number` };
      return { ok: true, value: Number(text) };
    }
    case "date": {
      if (!isValidCalendarDate(text))
        return { ok: false, message: `${field.label} must be a date in YYYY-MM-DD form` };
      return { ok: true, value: text };
    }
    case "select": {
      const options = field.options ?? [];
      if (!options.includes(text))
        return { ok: false, message: `${field.label}: "${text}" is not one of ${options.join(", ")}` };
      return { ok: true, value: text };
    }
    case "multiselect": {
      const options = field.options ?? [];
      const parts = text.split(MULTI_DELIM).map((p) => p.trim()).filter((p) => p !== "");
      const unknown = parts.filter((p) => !options.includes(p));
      if (unknown.length)
        return {
          ok: false,
          message: `${field.label}: ${unknown.map((u) => `"${u}"`).join(", ")} `
            + `is not one of ${options.join(", ")} (separate multiple values with "${MULTI_DELIM}")`,
        };
      return { ok: true, value: Array.from(new Set(parts)) };
    }
    case "url": {
      if (!/^https?:\/\/.+/.test(text))
        return { ok: false, message: `${field.label} must start with http:// or https://` };
      return { ok: true, value: text };
    }
    default:
      // Free text keeps whatever spacing the person typed; only the formula shield is stripped.
      return { ok: true, value: unescapeSpreadsheetValue(raw) };
  }
}

/** A cell counts as filled only if it has non-whitespace text. Mirrors the server's notion of
 *  blank for arrays and empty strings. */
export function isBlankValue(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Value a row currently holds for a field, or undefined when the field is hidden there. */
export function currentCell(row: TrackerGridRow, fieldKey: string): TrackerCell | undefined {
  return row.cells.find((c) => c.field_key === fieldKey);
}
