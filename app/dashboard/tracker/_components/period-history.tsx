"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { useRecordPeriodHistory } from "@/lib/queries/tracker";
import type { TrackerPeriodHistoryEntry } from "@/lib/tracker-api";

/**
 * Earlier occurrences of a recurring task, under the current one.
 *
 * The previous period is shown straight away — that is the one people actually
 * check — and older periods load on demand, because a daily task grows a row per
 * day indefinitely.
 *
 * A past period is either done or MISSED. Periods that were never created are not
 * rendered at all: the recurrence cron only ever spawns the current period, so a
 * gap means nobody was ever asked, which is not an omission by the fellow.
 */
export function PeriodHistory({
  recordId,
  recurring,
}: {
  recordId: string;
  /** One-time tasks have no earlier periods, so the section is absent entirely. */
  recurring: boolean;
}) {
  // Cursors the user has explicitly asked for; each renders one more page.
  const [cursors, setCursors] = useState<string[]>([]);

  const first = useRecordPeriodHistory(recordId, recurring);
  if (!recurring) return null;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Earlier periods
      </p>

      {first.isLoading ? (
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : !first.data || first.data.entries.length === 0 ? (
        <p className="text-xs text-gray-400">No earlier occurrences yet.</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {first.data.entries.map((e) => (
            <PeriodRow key={e.record_id} entry={e} />
          ))}
          {cursors.map((cursor) => (
            <MorePage key={cursor} recordId={recordId} before={cursor} />
          ))}
        </ol>
      )}

      <LoadMore
        recordId={recordId}
        cursors={cursors}
        firstCursor={first.data?.next_cursor ?? null}
        onLoad={(c) => setCursors((prev) => (prev.includes(c) ? prev : [...prev, c]))}
      />
    </div>
  );
}

/** One additional page, mounted only once the user has asked for it. */
function MorePage({ recordId, before }: { recordId: string; before: string }) {
  const { data, isLoading } = useRecordPeriodHistory(recordId, true, before);
  if (isLoading) {
    return (
      <li className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
      </li>
    );
  }
  return (
    <>
      {(data?.entries ?? []).map((e) => (
        <PeriodRow key={e.record_id} entry={e} />
      ))}
    </>
  );
}

/**
 * The disclosure button. It tracks the cursor of the LAST page rendered so far,
 * so repeated clicks walk backwards through the history one page at a time.
 */
function LoadMore({
  recordId,
  cursors,
  firstCursor,
  onLoad,
}: {
  recordId: string;
  cursors: string[];
  firstCursor: string | null;
  onLoad: (cursor: string) => void;
}) {
  const lastCursor = cursors.length ? cursors[cursors.length - 1] : null;
  const tail = useRecordPeriodHistory(recordId, Boolean(lastCursor), lastCursor ?? undefined);
  const next = lastCursor ? tail.data?.next_cursor ?? null : firstCursor;
  if (!next) return null;
  return (
    <button
      type="button"
      onClick={() => onLoad(next)}
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline"
    >
      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> Show earlier periods
    </button>
  );
}

function PeriodRow({ entry }: { entry: TrackerPeriodHistoryEntry }) {
  const done = entry.lifecycle === "done";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-gray-100 bg-white px-2.5 py-1.5">
      <span className="text-xs font-medium text-gray-800">{formatPeriod(entry.period_key)}</span>

      <span
        className={
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
          (done ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")
        }
      >
        {done ? (
          <>
            <Check className="h-3 w-3" aria-hidden="true" /> Done
          </>
        ) : (
          <>
            <TriangleAlert className="h-3 w-3" aria-hidden="true" /> Missed
          </>
        )}
      </span>

      {done && entry.updated_by_name && (
        <span className="text-xs text-gray-500">
          by {entry.updated_by_name} · {formatWhen(entry.updated_at)}
        </span>
      )}

      {entry.geo && (
        <span className="text-xs text-gray-500">
          {entry.geo.accepted ? "visit verified" : "visit not verified"} ·{" "}
          {Math.round(entry.geo.distance_m)} m
        </span>
      )}

      {entry.geo?.preview_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.geo.preview_url}
          alt={`Visit photo for ${formatPeriod(entry.period_key)}`}
          className="h-7 w-7 rounded border border-gray-200 object-cover"
        />
      )}
    </li>
  );
}

/** "2026-08-23" -> "23 Aug", "2026-W34" -> "Week 34", "2026-08" -> "Aug 2026". */
function formatPeriod(key: string): string {
  const week = /^(\d{4})-W(\d{2})$/.exec(key);
  if (week) return `Week ${Number(week[2])}, ${week[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) {
    const d = new Date(Number(month[1]), Number(month[2]) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (day) {
    const d = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  return key;
}

function formatWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
