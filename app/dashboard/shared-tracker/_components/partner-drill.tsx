"use client";

import { useState } from "react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { usePartnerBreakdown } from "@/lib/queries/tracker";
import { PARTNER_NO_PLACE, type PartnerTaskRow } from "@/lib/tracker-api";
import { ZONE } from "@/lib/labels";

/**
 * The geographic drill, scoped to one shared task.
 *
 * Levels are PLACES, not people. The internal breakdown walks Zonal Manager →
 * School In-Charge → School → Student; an outside official walks State → Zone →
 * School → Student instead. A funder needs to know where the work happened, not
 * who reports to whom, and a management hierarchy published to every official
 * ever seated in a programme cannot be unpublished.
 *
 * There is no programme level: one task type belongs to exactly one programme, so
 * inside a task it would be a level with a single row.
 *
 * The path is carried as named parts rather than one opaque parent id, because a
 * district name is not unique across states — "Mysuru" alone cannot identify a
 * zone, and a level key is a plain string for geography but a uuid for a school.
 */

type Level = "state" | "zone" | "school" | "student";

/** Where the drill stops, by what the task is actually about. */
function leafFor(target: PartnerTaskRow["target_type"]): Level {
  return target === "student" ? "student" : "school";
}

const LEVEL_TITLE: Record<Level, string> = {
  state: "States", zone: `${ZONE}s`, school: "Schools", student: "Students",
};

type Crumb = { level: Level; key: string; label: string };

export function PartnerDrill({ task, filters, onOpenRecords }: {
  task: PartnerTaskRow;
  /** The page's own filter bar. Carried through so the breakdown counts the same
   *  records the task card above it does; without it the two disagree on screen
   *  and nothing says which is right. */
  filters: Record<string, unknown>;
  onOpenRecords: (scope: {
    state?: string; district?: string; schoolId?: string; studentId?: string;
  }) => void;
}) {
  // A staff task has no geography at all, so the drill would be one bucket deep.
  // Sending the official straight to the records is more honest than a level that
  // only ever says "Not tied to a place".
  const geographic = task.target_type !== "fellow";
  const [path, setPath] = useState<Crumb[]>([]);

  const leaf = leafFor(task.target_type);
  const level: Level = (["state", "zone", "school", "student"] as Level[])[path.length] ?? leaf;
  const scope = {
    state: path.find((p) => p.level === "state")?.key,
    district: path.find((p) => p.level === "zone")?.key,
    schoolId: path.find((p) => p.level === "school")?.key,
  };

  const { data: rows, isLoading } = usePartnerBreakdown(
    geographic ? task.template_id : null, { ...filters, level, ...scope },
  );

  if (!geographic) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        This task is about a person rather than a place, so it has no geographic
        breakdown.{" "}
        <button onClick={() => onOpenRecords({})} className="font-medium text-teal-700 underline">
          See its records
        </button>
      </div>
    );
  }

  const atLeaf = level === leaf;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2 text-sm">
        {path.length > 0 && (
          <button
            onClick={() => setPath(path.slice(0, -1))}
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back
          </button>
        )}
        <button onClick={() => setPath([])} className="text-gray-500 hover:text-gray-900">
          All
        </button>
        {path.map((c, i) => (
          <span key={`${c.level}-${c.key}`} className="flex items-center gap-2">
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />
            <button
              onClick={() => setPath(path.slice(0, i + 1))}
              className="text-gray-700 hover:text-gray-900"
            >
              {c.label}
            </button>
          </span>
        ))}
        <span className="ml-auto text-xs uppercase tracking-wide text-gray-400">
          {LEVEL_TITLE[level]}
        </span>
      </header>

      {isLoading ? (
        <div className="flex min-h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
        </div>
      ) : !rows?.length ? (
        <p className="p-5 text-sm text-gray-500">Nothing recorded here yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => {
            const pct = r.total === 0 ? 0 : Math.round((r.done / r.total) * 100);
            // The last level opens the records; everything above it goes deeper.
            // At the leaf the clicked row IS the scope, so its own key has to go
            // in: without it, clicking one student opened every record for the
            // school, and clicking one school every record in the zone.
            // The no-place bucket has no geography to drill THROUGH — its state and
            // zone are null — so going deeper would ask the server to match a
            // sentinel against a real column and return nothing. It goes straight to
            // its records instead, at whatever level it appears.
            const go = () => (r.key === PARTNER_NO_PLACE
              ? onOpenRecords({ schoolId: PARTNER_NO_PLACE })
              : atLeaf
                ? onOpenRecords({
                  ...scope,
                  ...(level === "school" ? { schoolId: r.key } : {}),
                  ...(level === "student" ? { studentId: r.key } : {}),
                })
                : setPath([...path, { level, key: r.key, label: r.label }]));
            return (
              <li key={r.key}>
                <button onClick={go} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900">
                      {r.label}
                      {r.key === PARTNER_NO_PLACE && (
                        <span className="ml-2 text-xs text-gray-400">no school on record</span>
                      )}
                    </div>
                    {(r.overdue > 0 || r.blocked > 0) && (
                      <div className="mt-0.5 flex gap-3 text-xs">
                        {r.overdue > 0 && <span className="text-amber-700">{r.overdue} overdue</span>}
                        {r.blocked > 0 && <span className="text-red-700">{r.blocked} blocked</span>}
                      </div>
                    )}
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-right text-xs text-gray-600">{r.done} of {r.total}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
