"use client";

/**
 * A student's own attendance, from the same canonical API staff read.
 *
 * Deliberately free of backend vocabulary: no AUTO/MANUAL, no DERIVED, no
 * "link stream" or "register stream". A student sees where they were, and —
 * separately and clearly labelled — what their SCHOOL confirmed, which is not
 * a statement about them.
 */
import { useState } from "react";
import { useMyAttendance } from "@/lib/queries/attendance";
import type { AttendanceSeries } from "@/lib/attendance-api";

const PREVIEW = 30;

const STATUS = {
  PRESENT: { label: "Present", bg: "bg-green-100", fg: "text-green-700" },
  ABSENT: { label: "Absent", bg: "bg-red-100", fg: "text-red-700" },
  UNKNOWN: { label: "Not recorded", bg: "bg-slate-100", fg: "text-slate-500" },
} as const;

function seriesTitle(s: AttendanceSeries): string {
  return s.mode === "ONLINE" ? "Live classes" : "School attendance";
}

function entryDate(at: string, kind: string): string {
  return kind === "LIVE_CLASS"
    ? new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : at;
}

/**
 * One mode's card. The entry list is previewed rather than dumped: a student
 * with a term of history wants the headline first. It stays expandable, though
 * — a percentage you cannot audit is just an assertion.
 */
function SeriesCard({ s }: { s: AttendanceSeries }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? s.entries : s.entries.slice(0, PREVIEW);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-500">{seriesTitle(s)}</h2>
      {s.summary.marked === 0 ? (
        // A percentage of nothing is not zero attendance — it is no evidence.
        <p className="mt-2 text-slate-500">Nothing recorded yet.</p>
      ) : (
        <>
          <p className="mt-2 text-4xl font-bold text-[var(--dark-teal)]">{s.summary.pct}%</p>
          <p className="text-sm text-slate-500">
            {s.summary.present} of {s.summary.marked} recorded
          </p>
        </>
      )}
      <div className="mt-3 space-y-1.5">
        {shown.map((e) => (
          <div key={e.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-600">
              {e.kind === "LIVE_CLASS" ? e.label : entryDate(e.at, e.kind)}
              {e.kind === "LIVE_CLASS" && (
                <span className="ml-2 text-xs text-slate-400">{entryDate(e.at, e.kind)}</span>
              )}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[e.status].bg} ${STATUS[e.status].fg}`}>
              {STATUS[e.status].label}
            </span>
          </div>
        ))}
      </div>
      {s.entries.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 text-sm font-semibold text-[var(--teal)]"
        >
          {expanded ? "Show less" : `Show all ${s.entries.length}`}
        </button>
      )}
      {s.truncated && (
        <p className="mt-2 text-xs text-slate-500">
          Showing the most recent {s.entries.length}. Older records are in this
          period&apos;s total but not listed.
        </p>
      )}
    </div>
  );
}

export function StudentView() {
  const { data, isLoading } = useMyAttendance();

  if (isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!data) return <p className="text-slate-500">Could not load attendance.</p>;

  return (
    <div className="space-y-4">
      {data.series.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">Your attendance</h2>
          <p className="mt-2 text-slate-500">No attendance recorded yet.</p>
        </div>
      )}

      {data.series.map((s) => (
        <SeriesCard key={s.mode} s={s} />
      ))}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Your school</h2>
        {data.school_confirmations.total === 0 ? (
          <p className="mt-2 text-slate-500">No live classes for your school yet.</p>
        ) : (
          <>
            <p className="mt-2 text-lg text-[var(--dark-teal)]">
              Your school confirmed{" "}
              <b>{data.school_confirmations.attended} of {data.school_confirmations.total}</b> live classes
            </p>
            <p className="mt-1 text-xs text-slate-500">
              This is about your whole school, not your own attendance.
            </p>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">Global quizzes</h2>
        {data.quizzes.assigned === 0 ? (
          <p className="mt-2 text-slate-500">No global quizzes assigned yet.</p>
        ) : (
          <>
            <p className="mt-2 text-lg text-[var(--dark-teal)]">
              Completed <b>{data.quizzes.completed} of {data.quizzes.assigned}</b>
            </p>
            <div className="mt-3 space-y-1.5">
              {data.quizzes.items.map((q) => (
                <div key={q.id} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2 text-slate-700">{q.title}</span>
                  {q.completed ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">✓ Done</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Pending</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
