"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { usePartnerTasks, usePartnerFacets } from "@/lib/queries/tracker";
import { toQuery } from "@/lib/filters";
import { useUrlFilters } from "@/lib/filters/use-url-filters";
import { FilterBar } from "@/app/dashboard/tracker/_components/filter-bar";
import { partnerFilterSpec } from "@/app/dashboard/tracker/_components/filter-specs";
import type { PartnerLifecycle, PartnerTaskRow } from "@/lib/tracker-api";
import { PARTNER_TRACKER_NAME } from "@/lib/labels";
import { PartnerDrill } from "./_components/partner-drill";
import { PartnerRecords } from "./_components/partner-records";

/**
 * The tracker as a government or funding official reads it.
 *
 * A separate page rather than a filtered view of the internal tracker, and the
 * reason is not cosmetic: everything reachable from here comes from endpoints that
 * enforce both gates server-side — the official must be seated in the programme,
 * and each task type must have been opted in. A shared component with a role check
 * inside it would put the boundary somewhere a future edit could move by accident.
 *
 * It reuses the internal FILTER KIT, though, because an official and a programme
 * manager read a task list the same way, and two mental models for one idea is how
 * they drift apart.
 */

const CARDS: { key: PartnerLifecycle; label: string; tone: string }[] = [
  { key: "done", label: "Done", tone: "border-teal-200 bg-teal-50 text-teal-900" },
  { key: "in_progress", label: "In progress", tone: "border-blue-200 bg-blue-50 text-blue-900" },
  { key: "not_started", label: "Not started", tone: "border-gray-200 bg-gray-50 text-gray-700" },
  { key: "overdue", label: "Overdue", tone: "border-amber-200 bg-amber-50 text-amber-900" },
  { key: "blocked", label: "Blocked", tone: "border-red-200 bg-red-50 text-red-900" },
];

export default function SharedTrackerPage() {
  const { data: facets } = usePartnerFacets();
  const spec = useMemo(() => partnerFilterSpec(facets), [facets]);
  const { state, set, clear, activeCount } = useUrlFilters(spec);

  const [page, setPage] = useState(1);
  const [openTask, setOpenTask] = useState<PartnerTaskRow | null>(null);
  const [recordScope, setRecordScope] =
    useState<{ state?: string; district?: string; schoolId?: string; studentId?: string } | null>(null);

  // The filter kit writes every keystroke straight to the URL, which would put a
  // request on the wire per character. Debounced here rather than inside the kit so
  // the internal surfaces keep the behaviour they have: this is the one list that
  // pages over all history, so a wasted round trip costs the most here.
  const query = useMemo(() => toQuery(spec, state), [spec, state]);
  const queryKey = JSON.stringify(query);
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(JSON.parse(queryKey)), 250);
    return () => clearTimeout(t);
  }, [queryKey]);

  // Any filter change invalidates the page cursor: page 3 of a narrower filter is
  // empty, and an empty page reads as "no results" rather than "wrong page".
  useEffect(() => { setPage(1); }, [debounced]);

  const { data, isLoading } = usePartnerTasks({ ...debounced, page });
  const rows = data?.rows ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{PARTNER_TRACKER_NAME}</h1>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          Tasks that programme managers have chosen to share with you. This is not
          everything the programme tracks — only what has been shared.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CARDS.map((c) => {
          const n = data?.stateCounts?.[c.key] ?? 0;
          const on = state.status === c.key;
          return (
            <button
              key={c.key}
              onClick={() => set({ status: on ? undefined : c.key })}
              aria-pressed={on}
              className={`rounded-lg border px-4 py-2 text-left ${c.tone} ${on ? "ring-2 ring-teal-500 ring-offset-1" : ""}`}
            >
              <div className="text-xl font-semibold">{n}</div>
              <div className="text-xs">{c.label}</div>
            </button>
          );
        })}
      </div>

      <FilterBar
        spec={spec}
        state={state}
        set={set}
        clear={clear}
        activeCount={activeCount}
        primaryKeys={["q", "programme", "state", "zone"]}
      />

      {isLoading && !data ? (
        <div className="flex min-h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        // Two different empty states. "Nothing shared with you" is a fact about the
        // world and has to say who can change it; "no match" is a fact about the
        // filters and needs a way out. Showing the first while filters are active
        // would tell an official the programme has nothing, which is a lie.
        activeCount > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
            No shared tasks match these filters.{" "}
            <button onClick={clear} className="font-medium text-teal-700 underline">Clear filters</button>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="max-w-prose text-sm text-gray-600">
              Nothing has been shared with you yet. Programme managers choose which tasks to
              share, one at a time — once they do, the progress appears here.
            </p>
          </div>
        )
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-100">
            {rows.map((t) => {
              const pct = t.total === 0 ? 0 : Math.round((t.done / t.total) * 100);
              const open = openTask?.template_id === t.template_id;
              return (
                <li key={t.template_id}>
                  <button
                    onClick={() => { setOpenTask(open ? null : t); setRecordScope(null); }}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{t.name}</div>
                      <div className="truncate text-xs text-gray-500">
                        {t.programme_name}{t.description ? ` · ${t.description}` : ""}
                      </div>
                    </div>
                    <div className="w-40 shrink-0">
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-right text-xs text-gray-600">
                        {t.total === 0 ? "not yet assigned" : `${t.done} of ${t.total}`}
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-gray-300 ${open ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    />
                  </button>

                  {open && (
                    <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4">
                      {recordScope === null ? (
                        <PartnerDrill task={t} filters={debounced} onOpenRecords={setRecordScope} />
                      ) : (
                        <>
                          <button
                            onClick={() => setRecordScope(null)}
                            className="self-start text-xs font-medium text-teal-700 underline"
                          >
                            Back to the breakdown
                          </button>
                          <PartnerRecords task={t} scope={recordScope} filters={debounced} />
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total} tasks
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                    className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40">Previous</button>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                    className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {/* The honest caveat behind every geographic figure above. Chosen over
          stamping geography onto each record at issuance: the numbers are grouped
          by where students are now, and saying so costs nothing, whereas implying
          they were frozen at the time would be false. */}
      <p className="text-xs text-gray-500">
        Grouped by where students and schools are now. A student who transfers takes their
        past records with them, so historical figures follow current placements.
      </p>
    </div>
  );
}
