import type { RecordsView } from "./attendance-api";
import { STATUS_LABEL } from "./attendance-status";

/**
 * RFC 4180 quoting. Names contain commas, schools contain quotes, and a class
 * title can contain a newline — any of which silently corrupts a naive join.
 */
function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The report as a spreadsheet.
 *
 * Attendance ends up in places this app does not reach — a school's own
 * records, a funder's report, a meeting where nobody has a login. Retyping a
 * grid by hand is where the numbers stop matching.
 *
 * Statuses are exported as WORDS, never as the ✓ / ✗ / – glyphs: outside the
 * legend a bare dash reads as absent, and this file will be opened by people
 * who never saw the screen.
 */
export function recordsToCsv(data: RecordsView): string {
  const head = [
    "Student",
    "School",
    ...data.occasions.map((o) => o.label),
    "Present",
    "Recorded",
    "Percent",
  ];

  const rows = data.students.map((s) => [
    s.name,
    s.school_name ?? "",
    ...s.cells.map((c) => STATUS_LABEL[c]),
    s.present,
    s.marked,
    // A percentage of nothing is not zero — keep the blank blank.
    s.marked === 0 ? "" : `${s.pct}%`,
  ]);

  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

/** `attendance-<mode>-<from>-to-<to>.csv`, or a dated fallback. */
export function csvFilename(data: RecordsView, from: string, to: string): string {
  const span = from && to ? `${from}-to-${to}` : (data.occasions[0]?.at ?? "").slice(0, 10) || "all";
  return `attendance-${data.mode.toLowerCase()}-${span}.csv`;
}

/**
 * Hands the file to the browser. A BOM is prepended because Excel otherwise
 * mis-reads UTF-8 and mangles every non-ASCII student name.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
