/** Spreadsheet reading and writing for tracker bulk-fill.
 *
 *  Split from tracker-bulk-fill.ts so the pure row/value logic stays testable without a DOM,
 *  and so SheetJS is only ever pulled in by the code paths that actually touch a file — it is
 *  a couple of megabytes and no other part of the dashboard needs it.
 */
import type { TrackerField, TrackerGridRow } from "./tracker-api";
import {
  MAX_UPLOAD_BYTES, MAX_UPLOAD_ROWS, RECORD_ID_HEADER,
  buildExportRows, buildHeaders, type SheetRow,
} from "./tracker-bulk-fill";

export type SheetFormat = "csv" | "xlsx";

/** Filename-safe slug of a task name, so the downloaded file says what it is. */
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "task";
}

/** Writes the currently visible grid rows to a spreadsheet and hands it to the browser. */
export async function downloadGridTemplate(
  templateName: string,
  columns: TrackerField[],
  rows: TrackerGridRow[],
  format: SheetFormat,
): Promise<void> {
  const XLSX = await import("xlsx");
  const data = buildExportRows(columns, rows);
  const sheet = XLSX.utils.json_to_sheet(data, { header: buildHeaders(columns) });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Tasks");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `${slugify(templateName)}-${stamp}.${format}`, { bookType: format });
}

/** Writes an arbitrary set of already-built rows — used for the "download the rows that
 *  failed" escape hatch, so a partial import can be fixed and retried without redoing the
 *  rows that already saved. */
export async function downloadRows(
  filename: string,
  headers: string[],
  rows: SheetRow[],
  format: SheetFormat = "csv",
): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Tasks");
  XLSX.writeFile(book, `${filename}.${format}`, { bookType: format });
}

export class SheetReadError extends Error {}

/** One cell as text. A date cell becomes the YYYY-MM-DD the rest of the pipeline speaks, read
 *  from its local parts — the date someone typed into Excel is the date they meant, and going
 *  via UTC would shift it a day for anyone west of Greenwich. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  return String(v);
}

/** Reads an uploaded .csv/.xlsx into plain string rows keyed by header.
 *
 *  Size is checked before the file is decoded and the sheet's declared extent is checked
 *  before any row is built, so an oversized or maliciously compressed workbook is rejected
 *  rather than locking up the tab. Every cell comes back as text; type conversion happens
 *  later against the field definitions. */
export async function parseSheetFile(file: File): Promise<{ headers: string[]; rows: SheetRow[] }> {
  if (file.size > MAX_UPLOAD_BYTES)
    throw new SheetReadError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    );

  const XLSX = await import("xlsx");
  let book;
  try {
    // cellDates makes Excel hand back real dates rather than whatever the sheet's locale
    // happens to display, so a date typed into Excel still arrives as a date.
    book = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false, cellDates: true, dense: true });
  } catch (err) {
    throw new SheetReadError(
      `That file could not be read as a spreadsheet: ${err instanceof Error ? err.message : "unreadable"}`,
    );
  }

  const sheetName = book.SheetNames[0];
  const sheet = sheetName ? book.Sheets[sheetName] : undefined;
  if (!sheet) throw new SheetReadError("That file has no sheets in it.");

  // Refuse an over-large sheet from its declared range, before rows are materialised.
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  if (range && range.e.r - range.s.r > MAX_UPLOAD_ROWS)
    throw new SheetReadError(
      `That sheet has more than ${MAX_UPLOAD_ROWS.toLocaleString()} rows. Filter the grid and export a smaller batch.`,
    );

  // defval keeps blank cells present as empty strings, so a cleared cell is distinguishable
  // from a column the sheet never had.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (raw.length > MAX_UPLOAD_ROWS)
    throw new SheetReadError(
      `That sheet has ${raw.length.toLocaleString()} rows. The limit is ${MAX_UPLOAD_ROWS.toLocaleString()}.`,
    );

  const headers = raw.length
    ? Object.keys(raw[0])
    : (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })[0] ?? []);

  // Cell text is kept as it was typed. Only the headers are trimmed, because they have to match
  // the column names exactly; trimming the values would quietly edit what someone wrote.
  const rows: SheetRow[] = raw.map((r) => {
    const out: SheetRow = {};
    for (const [k, v] of Object.entries(r)) out[k.trim()] = cellText(v);
    return out;
  });

  if (!headers.some((h) => h.trim() === RECORD_ID_HEADER))
    throw new SheetReadError(
      `That file has no "${RECORD_ID_HEADER}" column. Upload the file you downloaded from this task, with your answers filled in.`,
    );

  return { headers: headers.map((h) => h.trim()), rows };
}
