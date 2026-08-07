"use client";

/**
 * Editable review grid for a register upload draft. Cell click cycles
 * present → absent → blank. Commit sends all non-null cells.
 *
 * The month is inferred from the sheet rather than declared by the operator, so
 * this is also where a wrong reading gets corrected: `Apply month` re-dates the
 * draft server-side and the parent swaps in the returned detail. Because the
 * cell state is seeded from props once, the grid is keyed on the dates it was
 * built from — a re-date or a retry rebuilds it instead of showing stale marks.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCommitRegister,
  useDiscardRegister,
  useRetryExtraction,
  useSetRegisterMonth,
} from "@/lib/queries/attendance";
import type { UploadDetail, CommitEntry } from "@/lib/attendance-api";

type CellState = boolean | null;

function nextState(s: CellState): CellState {
  if (s === null) return true;
  if (s === true) return false;
  return null;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Rebuild the cell state whenever the draft's *contents* change, not merely its
 * dates: a retry can return different P/A values over the same month and the
 * same span, and keying on the span alone would keep the old cells on screen
 * and let the reviewer commit readings the extraction no longer claims.
 */
function gridSignature(upload: UploadDetail): string {
  const cells = upload.grid
    .map((r) => `${r.student_id}:${Object.entries(r.marks).sort().map(([d, v]) => `${d}=${v}`).join(",")}`)
    .join("|");
  return `${upload.id}:${upload.status}:${upload.month ?? "none"}:${cells}`;
}

export function ReviewGrid({
  upload,
  onChange,
  onDone,
}: {
  upload: UploadDetail;
  /** Replaces the draft the parent holds — re-date and retry both return a new one. */
  onChange: (detail: UploadDetail) => void;
  onDone: () => void;
}) {
  return (
    <ReviewGridInner
      key={gridSignature(upload)}
      upload={upload}
      onChange={onChange}
      onDone={onDone}
    />
  );
}

function ReviewGridInner({
  upload,
  onChange,
  onDone,
}: {
  upload: UploadDetail;
  onChange: (detail: UploadDetail) => void;
  onDone: () => void;
}) {
  const commit = useCommitRegister();
  const discard = useDiscardRegister();
  const retry = useRetryExtraction();
  const setMonth = useSetRegisterMonth();

  // marks[studentId][date] = present/absent/blank
  const [marks, setMarks] = useState<Record<string, Record<string, CellState>>>(() => {
    const init: Record<string, Record<string, CellState>> = {};
    for (const row of upload.grid) {
      init[row.student_id] = { ...row.marks } as Record<string, CellState>;
    }
    return init;
  });
  const [newDate, setNewDate] = useState("");
  const [monthDraft, setMonthDraft] = useState(upload.month ?? "");

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const per of Object.values(marks)) {
      for (const d of Object.keys(per)) set.add(d);
    }
    return [...set].sort();
  }, [marks]);

  const readOnly = upload.status !== "PENDING_REVIEW";
  // Server-authoritative: recomputing "today - 14 months" here would drift with
  // the browser's clock and timezone, and it is the server that enforces it.
  const addMin = upload.allowed_start ?? upload.min_date;
  const addMax = upload.allowed_end ?? upload.max_date;

  const toggle = (studentId: string, date: string) => {
    if (readOnly) return;
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [date]: nextState(prev[studentId]?.[date] ?? null) },
    }));
  };

  const addColumn = () => {
    if (!newDate) return;
    if (newDate < addMin || newDate > addMax) {
      toast.error(`Date must be within ${addMin} … ${addMax}`);
      return;
    }
    setMarks((prev) => {
      const next = { ...prev };
      for (const sid of Object.keys(next)) {
        if (!(newDate in next[sid])) next[sid] = { ...next[sid], [newDate]: null };
      }
      // Ensure at least one row carries the date even if grid was empty.
      if (Object.keys(next).length === 0 && upload.grid[0]) {
        next[upload.grid[0].student_id] = { [newDate]: null };
      }
      return next;
    });
    setNewDate("");
  };

  const applyMonth = () => {
    if (!monthDraft) return;
    setMonth.mutate(
      { id: upload.id, month: monthDraft },
      {
        onSuccess: (detail) => {
          toast.success(`Re-dated to ${monthLabel(monthDraft)}`);
          onChange(detail);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const entries: CommitEntry[] = useMemo(() => {
    const out: CommitEntry[] = [];
    for (const [student_id, per] of Object.entries(marks)) {
      for (const [date, present] of Object.entries(per)) {
        if (present !== null) out.push({ student_id, date, present });
      }
    }
    return out;
  }, [marks]);

  const doCommit = () => {
    if (entries.length === 0) {
      toast.error("Nothing to commit — fill in at least one cell.");
      return;
    }
    if (!window.confirm(
      `Commit ${entries.length} entries? This overwrites any existing attendance for these students/dates.`,
    )) return;
    commit.mutate(
      { id: upload.id, entries },
      {
        onSuccess: () => { toast.success("Register committed"); onDone(); },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const isEmptyDraft = upload.grid.every((g) => Object.keys(marks[g.student_id] ?? {}).length === 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-[var(--dark-teal)]" style={{ fontFamily: "var(--font-heading)" }}>
          {upload.school_name}
        </h3>
        <span className="text-sm text-slate-500">
          {upload.month
            ? `${monthLabel(upload.month)}${
                upload.period_start && upload.period_end
                  ? ` · ${upload.period_start.slice(8)}–${upload.period_end.slice(8)}`
                  : ""
              }`
            : "No dates detected"}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          upload.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700"
          : upload.status === "COMMITTED" ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500"
        }`}>{upload.status.replace("_", " ")}</span>
        {upload.model && <span className="text-xs text-slate-400">extracted by {upload.model}</span>}
        {upload.override_month && (
          <span className="text-xs text-slate-400">
            {upload.override_mode === "REMAP"
              ? "month corrected by hand — days re-dated"
              : "month chosen by hand"}
          </span>
        )}
        <span className="flex-1" />
        <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
      </div>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-medium text-slate-600">
            {upload.month ? "Month read off the sheet" : "Which month is this register?"}
          </label>
          <input
            type="month"
            value={monthDraft}
            min={upload.min_date.slice(0, 7)}
            max={upload.max_date.slice(0, 7)}
            onChange={(e) => setMonthDraft(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            disabled={setMonth.isPending || !monthDraft || monthDraft === upload.month}
            onClick={applyMonth}
            className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--dark-teal)] hover:bg-[var(--color-mint-soft)] disabled:opacity-40"
          >
            {setMonth.isPending ? "Applying…" : "Apply month"}
          </button>
          <span className="text-xs text-slate-400">
            Corrects the whole draft if the month was misread. The days stay as they are.
          </span>
        </div>
      )}

      {upload.extraction_error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Nothing could be read from this file</p>
          <p className="mt-1 text-xs">{upload.extraction_error}</p>
        </div>
      )}

      {(upload.dropped_invalid > 0 || upload.tie_broken || upload.dropped_days > 0) && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {upload.dropped_invalid > 0 && (
            <p>
              {upload.dropped_invalid} date column(s) were unreadable or outside the plausible
              range and were ignored. Add them by hand below if the sheet has them.
            </p>
          )}
          {upload.dropped_days > 0 && (
            <p className="mt-1">
              {upload.dropped_days} column(s) were dropped by the re-date — those days don&apos;t
              exist in {upload.month ? monthLabel(upload.month) : "the chosen month"}. Check the
              month is right before committing.
            </p>
          )}
          {upload.tie_broken && (
            <p className="mt-1">
              Two months looked equally likely — the earlier one was used. Check the month above.
            </p>
          )}
        </div>
      )}

      {upload.dropped_other_month > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          A register covers one month, so {upload.dropped_other_month} column(s) dated{" "}
          {upload.other_months.map(monthLabel).join(", ")} are not shown. Switch the month above to
          review those instead — a draft can only be re-dated before it is committed, so upload the
          file again if you need both months.
        </div>
      )}

      {upload.unmatched.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">{upload.unmatched.length} extracted row(s) didn&apos;t match a student</p>
          <p className="mt-1 text-xs">
            These are ignored unless you enter their data manually below:{" "}
            {upload.unmatched.map((u) => u.name ?? u.short_code ?? "?").join(", ")}
          </p>
        </div>
      )}

      {!readOnly && isEmptyDraft && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 flex flex-wrap items-center gap-3">
          <span>
            Draft is empty (extraction failed or found nothing). Set the month above, then add
            date columns and fill them in by hand — or re-run extraction.
          </span>
          <button
            disabled={retry.isPending}
            onClick={() => retry.mutate(upload.id, {
              onSuccess: (detail) => { toast.success("Extraction re-run"); onChange(detail); },
              onError: (e) => toast.error(e.message),
            })}
            className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--dark-teal)] hover:bg-[var(--color-mint-soft)]"
          >
            {retry.isPending ? "Retrying…" : "Retry extraction"}
          </button>
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="px-2 py-1.5 font-medium">Code</th>
              <th className="px-2 py-1.5 font-medium">Student</th>
              {dates.map((d) => (
                <th key={d} className="px-2 py-1.5 font-medium whitespace-nowrap">{d.slice(5)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upload.grid.map((row) => (
              <tr key={row.student_id} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-slate-400">{row.short_code}</td>
                <td className="px-2 py-1.5 font-medium text-[var(--dark-teal)] whitespace-nowrap">{row.name}</td>
                {dates.map((d) => {
                  const v = marks[row.student_id]?.[d] ?? null;
                  return (
                    <td key={d} className="px-1 py-1">
                      <button
                        onClick={() => toggle(row.student_id, d)}
                        disabled={readOnly}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${
                          v === true ? "bg-green-100 text-green-700"
                          : v === false ? "bg-red-100 text-red-600"
                          : "bg-slate-100 text-slate-300"
                        } ${readOnly ? "cursor-default" : "hover:ring-2 hover:ring-[var(--teal)]"}`}
                      >
                        {v === true ? "P" : v === false ? "A" : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={newDate}
            min={addMin}
            max={addMax}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            onClick={addColumn}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Add date column
          </button>
          <span className="flex-1" />
          <button
            onClick={() => {
              if (!window.confirm("Discard this upload? The file stays stored but the draft is dropped.")) return;
              discard.mutate(upload.id, {
                onSuccess: () => { toast.success("Upload discarded"); onDone(); },
                onError: (e) => toast.error(e.message),
              });
            }}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Discard
          </button>
          <button
            disabled={commit.isPending}
            onClick={doCommit}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]"
          >
            {commit.isPending ? "Committing…" : `Commit ${entries.length} entries`}
          </button>
        </div>
      )}
    </div>
  );
}
