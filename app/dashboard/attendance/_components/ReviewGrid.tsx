"use client";

/**
 * Editable review grid for a register upload draft. Cell click cycles
 * present → absent → blank. Commit sends all non-null cells.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCommitRegister,
  useDiscardRegister,
  useRetryExtraction,
} from "@/lib/queries/attendance";
import type { UploadDetail, CommitEntry } from "@/lib/attendance-api";

type CellState = boolean | null;

function nextState(s: CellState): CellState {
  if (s === null) return true;
  if (s === true) return false;
  return null;
}

export function ReviewGrid({ upload, onDone }: { upload: UploadDetail; onDone: () => void }) {
  const commit = useCommitRegister();
  const discard = useDiscardRegister();
  const retry = useRetryExtraction();

  // marks[studentId][date] = present/absent/blank
  const [marks, setMarks] = useState<Record<string, Record<string, CellState>>>(() => {
    const init: Record<string, Record<string, CellState>> = {};
    for (const row of upload.grid) {
      init[row.student_id] = { ...row.marks } as Record<string, CellState>;
    }
    return init;
  });
  const [newDate, setNewDate] = useState("");

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const per of Object.values(marks)) {
      for (const d of Object.keys(per)) set.add(d);
    }
    return [...set].sort();
  }, [marks]);

  const readOnly = upload.status !== "PENDING_REVIEW";

  const toggle = (studentId: string, date: string) => {
    if (readOnly) return;
    setMarks((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [date]: nextState(prev[studentId]?.[date] ?? null) },
    }));
  };

  const addColumn = () => {
    if (!newDate) return;
    if (newDate < upload.period_start || newDate > upload.period_end) {
      toast.error(`Date must be within ${upload.period_start} … ${upload.period_end}`);
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-800">
          {upload.school_name} · {upload.period_start} → {upload.period_end}
        </h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          upload.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700"
          : upload.status === "COMMITTED" ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500"
        }`}>{upload.status.replace("_", " ")}</span>
        {upload.model && <span className="text-xs text-slate-400">extracted by {upload.model}</span>}
        <span className="flex-1" />
        <button onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
      </div>

      {upload.unmatched.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">{upload.unmatched.length} extracted row(s) didn&apos;t match a student</p>
          <p className="mt-1 text-xs">
            These are ignored unless you enter their data manually below:{" "}
            {upload.unmatched.map((u) => u.name ?? u.short_code ?? "?").join(", ")}
          </p>
        </div>
      )}

      {!readOnly && upload.grid.every((g) => Object.keys(marks[g.student_id] ?? {}).length === 0) && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 flex items-center gap-3">
          <span>Draft is empty (extraction failed or found nothing).</span>
          <button
            disabled={retry.isPending}
            onClick={() => retry.mutate(upload.id, {
              onSuccess: () => toast.success("Extraction re-run — reopen this upload to see results"),
              onError: (e) => toast.error(e.message),
            })}
            className="rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
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
                <td className="px-2 py-1.5 font-medium text-slate-800 whitespace-nowrap">{row.name}</td>
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
                        } ${readOnly ? "cursor-default" : "hover:ring-2 hover:ring-indigo-200"}`}
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
            min={upload.period_start}
            max={upload.period_end}
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
              if (!window.confirm("Discard this upload? The photo stays stored but the draft is dropped.")) return;
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
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {commit.isPending ? "Committing…" : `Commit ${entries.length} entries`}
          </button>
        </div>
      )}
    </div>
  );
}
