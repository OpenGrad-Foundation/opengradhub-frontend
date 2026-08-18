/** Validates an uploaded bulk-fill sheet against the grid it claims to belong to.
 *
 *  Everything here is a pre-flight for POST /tracker/records/batch. That endpoint saves a whole
 *  batch in one transaction, so a single rejected row takes the rest of its batch down with it;
 *  catching bad rows here is what keeps one typo from wasting an import. The server re-runs all
 *  of these checks regardless — this is a better error message, not a security boundary.
 */
import type { TrackerBatchEdit, TrackerField, TrackerGridRow } from "./tracker-api";
import {
  CONTEXT_HEADERS, PROBLEM_HEADER, RECORD_ID_HEADER,
  currentCell, editableFields, escapeSpreadsheetValue, fieldsByHeader, headersByFieldKey,
  isBlankValue, parseCellValue, serializeCellValue, undelimitableOptions,
  type SheetRow,
} from "./tracker-bulk-fill";

export type CellIssue = { header: string; message: string };

export type PreparedRow = {
  /** 1-based row number as it appears in the spreadsheet, header included, so an error can be
   *  pointed at a line the user can actually find. */
  sheetRow: number;
  recordId: string;
  /** The grid row this maps onto, when it could be resolved. */
  row?: TrackerGridRow;
  label: string;
  /** Only the fields this upload actually changes. */
  values: Record<string, unknown>;
  errors: CellIssue[];
  warnings: CellIssue[];
  /** Present but unchanged: nothing to send, so it is skipped rather than counted as an error. */
  unchanged: boolean;
};

export type PreparedSheet = {
  rows: PreparedRow[];
  /** Problems with the file as a whole, which block the entire upload. */
  fatal: string[];
};

/** True when the uploaded value is the one the record already holds.
 *
 *  Numbers are compared numerically: the server accepts a numeric string and stores it as given,
 *  so a record can hold "42" where the sheet parses to 42. Treating those as different would
 *  re-send the row and log a change that did not happen. */
function sameValue(field: TrackerField, uploaded: unknown, current: unknown): boolean {
  if (field.field_type === "number" && current !== null && current !== undefined && current !== "")
    return Number(uploaded) === Number(current);
  return JSON.stringify(uploaded ?? null) === JSON.stringify(current ?? null);
}

export function prepareUpload(
  columns: TrackerField[],
  gridRows: TrackerGridRow[],
  headers: string[],
  sheetRows: SheetRow[],
): PreparedSheet {
  const fatal: string[] = [];
  const byHeader = fieldsByHeader(columns);

  for (const option of undelimitableOptions(columns))
    fatal.push(
      `The option ${option} contains a "${";"}", which bulk upload uses to separate multiple `
      + "answers in one cell. Edit that option before using bulk upload for this task.",
    );

  // An unrecognised column usually means the file came from a different task, or the task's
  // fields changed after it was downloaded. Either way, guessing would be worse than stopping.
  const known = new Set<string>([
    RECORD_ID_HEADER, ...CONTEXT_HEADERS, PROBLEM_HEADER, ...byHeader.keys(),
  ]);
  const unknownHeaders = headers.filter((h) => h !== "" && !known.has(h));
  if (unknownHeaders.length)
    fatal.push(
      `This file has columns that do not belong to this task: ${unknownHeaders.map((h) => `"${h}"`).join(", ")}. `
      + "Download a fresh copy and fill that in instead.",
    );

  // Two columns that trim to the same heading would have silently overwritten one another when
  // the rows were built, so the file cannot be read with confidence.
  const dupHeaders = headers.filter((h, i) => h !== "" && headers.indexOf(h) !== i);
  if (dupHeaders.length)
    fatal.push(
      `This file has more than one "${dupHeaders[0]}" column. Download a fresh copy and fill that in instead.`,
    );

  const byRecordId = new Map(gridRows.map((r) => [r.record_id, r] as const));
  const seen = new Map<string, number>();
  const rows: PreparedRow[] = [];

  sheetRows.forEach((sheet, i) => {
    const sheetRow = i + 2; // +1 for 0-based index, +1 for the header line
    const recordId = (sheet[RECORD_ID_HEADER] ?? "").trim();
    const gridRow = byRecordId.get(recordId);
    const label = sheet.Name || sheet.School || recordId || `Row ${sheetRow}`;
    const errors: CellIssue[] = [];
    const warnings: CellIssue[] = [];
    const values: Record<string, unknown> = {};

    if (!recordId) {
      errors.push({ header: RECORD_ID_HEADER, message: "This row has no record_id, so there is nothing to fill in." });
      rows.push({ sheetRow, recordId, label, values, errors, warnings, unchanged: false });
      return;
    }

    // Two rows for the same record would be applied one after another against the same starting
    // values, so the later one would quietly undo part of the earlier one.
    const firstSeen = seen.get(recordId);
    if (firstSeen !== undefined)
      errors.push({
        header: RECORD_ID_HEADER,
        message: `This record already appears on row ${firstSeen}. Remove the duplicate before uploading.`,
      });
    else seen.set(recordId, sheetRow);

    if (!gridRow) {
      errors.push({
        header: RECORD_ID_HEADER,
        message: "This record is not in the task list you are looking at. It may have been removed, or the file "
          + "may be from a different task or a different filter.",
      });
      rows.push({ sheetRow, recordId, label, values, errors, warnings, unchanged: false });
      return;
    }

    // The context columns are for orientation only and are never written back, but a mismatch is
    // worth pointing out: it means the sheet was taken before something changed.
    if (sheet.Name && gridRow.target_name && sheet.Name !== gridRow.target_name)
      warnings.push({ header: "Name", message: `This row is now "${gridRow.target_name}" in the task list.` });
    if (sheet.Status && gridRow.status && sheet.Status !== gridRow.status)
      warnings.push({ header: "Status", message: `Status has since changed to "${gridRow.status}".` });

    for (const header of headers) {
      const field = byHeader.get(header);
      if (!field) continue; // record_id and the context columns
      // The cell is passed on as it was typed — each field type decides for itself whether
      // surrounding space is noise. Emptiness is judged on the trimmed text, so a cell holding
      // only spaces counts as untouched.
      const rawText = sheet[header] ?? "";
      const isBlankCell = rawText.trim() === "";
      const cell = currentCell(gridRow, field.field_key);

      // A field hidden on this row by a conditional rule has no cell here. Writing it anyway
      // would store a value that nothing displays and that validation does not check, only for
      // it to surface later if the rule starts matching.
      if (!cell) {
        if (!isBlankCell)
          warnings.push({
            header,
            message: "This field does not apply to this row, so it was left out.",
          });
        continue;
      }

      if (isBlankCell) continue; // blank means "leave as it is", never "clear it"

      const parsed = parseCellValue(field, rawText);
      if (!parsed.ok) {
        errors.push({ header, message: parsed.message });
        continue;
      }
      if (sameValue(field, parsed.value, cell.value)) continue; // already saved with this value
      values[field.field_key] = parsed.value;
    }

    // The server validates the record as it will be after the merge, so a required field that is
    // still empty rejects the save even when this upload never touched it. Without this check the
    // failure would only appear once the batch was submitted, blaming the wrong rows.
    if (Object.keys(values).length > 0) {
      for (const field of editableFields(columns)) {
        if (!field.required) continue;
        const cell = currentCell(gridRow, field.field_key);
        if (!cell) continue; // hidden here, so the server skips it too
        const after = field.field_key in values ? values[field.field_key] : cell.value;
        if (isBlankValue(after))
          errors.push({
            header: field.label,
            message: `${field.label} is required and is still empty, so this row cannot be saved.`,
          });
      }
    }

    rows.push({
      sheetRow, recordId, row: gridRow, label, values, errors, warnings,
      unchanged: errors.length === 0 && Object.keys(values).length === 0,
    });
  });

  return { rows, fatal };
}

/** The rows that are safe to send. */
export function submittableEdits(prepared: PreparedRow[]): TrackerBatchEdit[] {
  return prepared
    .filter((r) => r.errors.length === 0 && !r.unchanged)
    .map((r) => ({ record_id: r.recordId, values: r.values }));
}

/** Rebuilds sheet rows for the records that could not be saved, so they can be downloaded,
 *  corrected and uploaded again without touching the ones that went through. */
export function buildFailedRows(
  columns: TrackerField[],
  prepared: PreparedRow[],
  failures: Map<string, string>,
): SheetRow[] {
  const fields = editableFields(columns);
  const headers = headersByFieldKey(columns);
  const esc = escapeSpreadsheetValue;
  return prepared
    .filter((r) => failures.has(r.recordId))
    .map((r) => {
      const out: SheetRow = {
        [RECORD_ID_HEADER]: r.recordId,
        Name: esc(r.row?.target_name ?? ""),
        School: esc(r.row?.school_name ?? ""),
        Status: esc(r.row?.status ?? ""),
        [PROBLEM_HEADER]: esc(failures.get(r.recordId) ?? ""),
      };
      for (const f of fields) {
        const submitted = r.values[f.field_key];
        const cell = r.row ? currentCell(r.row, f.field_key) : undefined;
        out[headers.get(f.field_key)!] = esc(
          serializeCellValue(f, submitted !== undefined ? submitted : cell?.value ?? null),
        );
      }
      return out;
    });
}
