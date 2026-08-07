"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, X } from "lucide-react";
import { saveTrackerBatch, type TrackerField, type TrackerGridRow, type TrackerTemplate } from "@/lib/tracker-api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import {
  CONTEXT_HEADERS, PROBLEM_HEADER, RECORD_ID_HEADER, editableFields, headersByFieldKey,
} from "@/lib/tracker-bulk-fill";
import { SheetReadError, downloadRows, parseSheetFile } from "@/lib/tracker-bulk-file";
import {
  buildFailedRows, prepareUpload, submittableEdits,
  type PreparedRow, type PreparedSheet,
} from "@/lib/tracker-bulk-validate";
import { submitBulkEdits, type BulkSubmitProgress } from "@/lib/tracker-bulk-submit";

type Phase =
  | { kind: "picking" }
  | { kind: "reading" }
  | { kind: "preview"; fileName: string; sheet: PreparedSheet }
  | { kind: "submitting"; fileName: string; sheet: PreparedSheet; progress: BulkSubmitProgress }
  | { kind: "done"; fileName: string; sheet: PreparedSheet; saved: number; failures: Map<string, string> };

/**
 * Uploads a filled-in copy of a task's spreadsheet back into the grid.
 *
 * The file is checked against the rows currently on screen before anything is sent: rows that
 * cannot be saved are shown with the reason, and only the rest go to the server. Saving happens
 * in chunks so one bad row cannot discard the whole upload, and whatever still fails server-side
 * comes back listed and downloadable.
 */
export function TrackerBulkUploadPanel({
  template,
  columns,
  rows,
  onClose,
}: {
  template: TrackerTemplate;
  columns: TrackerField[];
  rows: TrackerGridRow[];
  onClose: () => void;
}) {
  const invalidate = useInvalidate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "picking" });
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => editableFields(columns), [columns]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPhase({ kind: "reading" });
    try {
      const { headers, rows: sheetRows } = await parseSheetFile(file);
      const sheet = prepareUpload(columns, rows, headers, sheetRows);
      setPhase({ kind: "preview", fileName: file.name, sheet });
    } catch (err) {
      setError(err instanceof SheetReadError || err instanceof Error ? err.message : "That file could not be read.");
      setPhase({ kind: "picking" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onSubmit(fileName: string, sheet: PreparedSheet) {
    const edits = submittableEdits(sheet.rows);
    if (edits.length === 0) return;
    setError(null);
    setPhase({ kind: "submitting", fileName, sheet, progress: { attempted: 0, total: edits.length } });
    const result = await submitBulkEdits(
      (batch) => saveTrackerBatch(batch),
      edits,
      (progress) => setPhase((p) => (p.kind === "submitting" ? { ...p, progress } : p)),
    );
    // One refresh at the end: the chunks and any bisection retries would otherwise each
    // trigger their own refetch of the grid while the upload is still running.
    invalidate("tracker");
    setPhase({
      kind: "done", fileName, sheet,
      saved: result.savedRecordIds.length,
      failures: result.failures,
    });
  }

  async function onDownloadFailed(sheet: PreparedSheet, failures: Map<string, string>) {
    const failedRows = buildFailedRows(columns, sheet.rows, failures);
    const byKey = headersByFieldKey(columns);
    const headers = [
      RECORD_ID_HEADER, ...CONTEXT_HEADERS, PROBLEM_HEADER,
      ...fields.map((f) => byKey.get(f.field_key)!),
    ];
    await downloadRows(`${template.code || "task"}-rows-to-fix`, headers, failedRows, "csv");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Bulk upload for ${template.name}`}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-950">Bulk upload</h2>
            <p className="text-xs text-gray-500">{template.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {(phase.kind === "picking" || phase.kind === "reading") && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Download this task&apos;s spreadsheet, fill in the blank cells, then upload it here. Cells you
                leave blank stay as they are — nothing is cleared.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => void onPick(e.target.files?.[0])}
                disabled={phase.kind === "reading"}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-teal-700"
              />
              {phase.kind === "reading" && (
                <p className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading the file…
                </p>
              )}
            </div>
          )}

          {(phase.kind === "preview" || phase.kind === "submitting") && (
            <PreviewTable sheet={phase.sheet} fields={fields} />
          )}

          {phase.kind === "done" && (
            <ResultSummary saved={phase.saved} failures={phase.failures} sheet={phase.sheet} />
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
          <FooterStatus phase={phase} />
          <div className="flex items-center gap-2">
            {phase.kind === "done" && phase.failures.size > 0 && (
              <button
                type="button"
                onClick={() => void onDownloadFailed(phase.sheet, phase.failures)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" /> Download rows to fix
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              {phase.kind === "done" ? "Close" : "Cancel"}
            </button>
            {phase.kind === "preview" && (
              <button
                type="button"
                onClick={() => void onSubmit(phase.fileName, phase.sheet)}
                disabled={phase.sheet.fatal.length > 0 || submittableEdits(phase.sheet.rows).length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" />
                Upload {submittableEdits(phase.sheet.rows).length} row
                {submittableEdits(phase.sheet.rows).length === 1 ? "" : "s"}
              </button>
            )}
            {phase.kind === "submitting" && (
              <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white opacity-70">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function FooterStatus({ phase }: { phase: Phase }) {
  if (phase.kind === "preview") {
    const ready = submittableEdits(phase.sheet.rows).length;
    const bad = phase.sheet.rows.filter((r) => r.errors.length > 0).length;
    const skipped = phase.sheet.rows.filter((r) => r.unchanged).length;
    return (
      <p className="text-xs text-gray-600">
        {ready} row{ready === 1 ? "" : "s"} ready
        {bad > 0 && <span className="text-red-600"> · {bad} with problems</span>}
        {skipped > 0 && <span className="text-gray-500"> · {skipped} unchanged</span>}
      </p>
    );
  }
  if (phase.kind === "submitting")
    return (
      <p className="text-xs text-gray-600">
        Saving {phase.progress.attempted} of {phase.progress.total}…
      </p>
    );
  return <span />;
}

function PreviewTable({ sheet, fields }: { sheet: PreparedSheet; fields: TrackerField[] }) {
  if (sheet.fatal.length > 0)
    return (
      <div className="space-y-2">
        {sheet.fatal.map((f, i) => (
          <p key={i} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{f}</p>
        ))}
      </div>
    );

  if (sheet.rows.length === 0)
    return <p className="text-sm text-gray-600">That file has no rows in it.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-2 py-2 font-medium">Row</th>
            <th className="px-2 py-2 font-medium">Who</th>
            <th className="px-2 py-2 font-medium">Changes</th>
            <th className="px-2 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((r) => (
            <PreviewRow key={`${r.sheetRow}-${r.recordId}`} row={r} fields={fields} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewRow({ row, fields }: { row: PreparedRow; fields: TrackerField[] }) {
  const labelOf = (key: string) => fields.find((f) => f.field_key === key)?.label ?? key;
  const bad = row.errors.length > 0;
  return (
    <tr className={"border-b border-gray-100 align-top " + (bad ? "bg-red-50/60" : "")}>
      <td className="px-2 py-2 text-xs text-gray-500">{row.sheetRow}</td>
      <td className="px-2 py-2 text-gray-800">{row.label}</td>
      <td className="px-2 py-2 text-gray-700">
        {Object.keys(row.values).length === 0 ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {Object.keys(row.values).map((k) => (
              <li key={k}>
                <span className="text-gray-500">{labelOf(k)}:</span>{" "}
                <span className="font-medium">{formatPreview(row.values[k])}</span>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-2 py-2">
        {bad ? (
          <ul className="space-y-0.5">
            {row.errors.map((e, i) => (
              <li key={i} className="flex items-start gap-1 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e.message}
              </li>
            ))}
          </ul>
        ) : row.unchanged ? (
          <span className="text-xs text-gray-400">Nothing new</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-teal-700">
            <CheckCircle2 className="h-3 w-3" /> Ready
          </span>
        )}
        {row.warnings.map((w, i) => (
          <p key={i} className="mt-0.5 text-xs text-amber-700">{w.message}</p>
        ))}
      </td>
    </tr>
  );
}

function ResultSummary({
  saved, failures, sheet,
}: { saved: number; failures: Map<string, string>; sheet: PreparedSheet }) {
  const byRecord = new Map(sheet.rows.map((r) => [r.recordId, r] as const));
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-gray-800">
        <CheckCircle2 className="h-4 w-4 text-teal-600" />
        {saved} row{saved === 1 ? "" : "s"} saved.
        {failures.size > 0 && ` ${failures.size} could not be saved.`}
      </p>
      {failures.size > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="mb-2 text-xs font-medium text-red-800">
            These rows were left unchanged. Everything else has already been saved.
          </p>
          <ul className="space-y-1">
            {Array.from(failures.entries()).map(([recordId, message]) => (
              <li key={recordId} className="text-xs text-red-700">
                <span className="font-medium">
                  {byRecord.get(recordId)?.label ?? recordId}
                  {byRecord.get(recordId) ? ` (row ${byRecord.get(recordId)!.sheetRow})` : ""}:
                </span>{" "}
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatPreview(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v ?? "");
}
