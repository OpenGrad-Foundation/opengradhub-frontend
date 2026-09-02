"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listPartnerProgrammes, listPartnerTasks, listPartnerRecords, listPartnerProofs,
  type PartnerProgramme, type PartnerTask, type PartnerRecord, type PartnerProof,
} from "@/lib/tracker-api";
import { IN_CHARGE } from "@/lib/labels";

/**
 * The tracker as a government or funding official sees it.
 *
 * A separate page rather than a filtered view of the internal tracker, and the
 * reason is not cosmetic: everything reachable from here comes from four
 * endpoints that enforce both gates server-side — the official must be seated in
 * the programme, and each task type must have been opted in. A shared component
 * with a role check inside it would put the boundary in a place a future edit
 * could move by accident.
 *
 * There is no filter, no search and no export. This is a small, deliberate
 * surface: three levels of drill and a proof viewer.
 */
export default function SharedTrackerPage() {
  const [programmes, setProgrammes] = useState<PartnerProgramme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PartnerTask[] | null>(null);
  const [openTask, setOpenTask] = useState<PartnerTask | null>(null);
  const [records, setRecords] = useState<PartnerRecord[] | null>(null);
  const [proofsFor, setProofsFor] = useState<PartnerRecord | null>(null);
  const [proofs, setProofs] = useState<PartnerProof[] | null>(null);

  useEffect(() => {
    listPartnerProgrammes()
      .then((p) => { setProgrammes(p); if (p.length === 1) setProgrammeId(p[0].id); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load programmes."));
  }, []);

  useEffect(() => {
    if (!programmeId) { setTasks(null); return; }
    setTasks(null); setOpenTask(null); setRecords(null);
    listPartnerTasks(programmeId)
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load tasks."));
  }, [programmeId]);

  const openRecords = async (t: PartnerTask) => {
    setOpenTask(t); setRecords(null); setProofsFor(null); setProofs(null);
    try { setRecords(await listPartnerRecords(t.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load records."); }
  };

  const openProofs = async (r: PartnerRecord) => {
    setProofsFor(r); setProofs(null);
    try { setProofs(await listPartnerProofs(r.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load proofs."); }
  };

  const programme = useMemo(
    () => programmes?.find((p) => p.id === programmeId) ?? null,
    [programmes, programmeId],
  );

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
  }
  if (!programmes) return <p className="text-sm text-gray-500">Loading…</p>;

  // An official with no shared programmes should be told why the page is empty.
  // "No data" reads as a fault; this is a deliberate state, and the thing they
  // need to know is who can change it.
  if (programmes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-gray-900">Shared progress</h1>
        <p className="mt-2 max-w-prose text-sm text-gray-600">
          Nothing has been shared with you yet. Programme managers choose which tasks to
          share, one at a time — once they do, the progress appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Shared progress</h1>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          Tasks that programme managers have chosen to share with you. This is not everything
          the programme tracks — only what has been shared.
        </p>
      </div>

      {programmes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {programmes.map((p) => (
            <button
              key={p.id}
              onClick={() => setProgrammeId(p.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                p.id === programmeId
                  ? "border-teal-600 bg-teal-50 text-teal-800"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {p.name}
              <span className="ml-2 text-xs text-gray-500">{p.shared_task_types}</span>
            </button>
          ))}
        </div>
      )}

      {programme && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-medium text-gray-900">{programme.name}</h2>
          </header>
          {!tasks ? (
            <p className="p-5 text-sm text-gray-500">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tasks.map((t) => {
                const pct = t.total === 0 ? 0 : Math.round((t.done / t.total) * 100);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => openRecords(t)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-gray-900">{t.name}</div>
                        {t.description && (
                          <div className="truncate text-xs text-gray-500">{t.description}</div>
                        )}
                      </div>
                      <div className="w-40 shrink-0">
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-teal-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1 text-right text-xs text-gray-600">
                          {t.done} of {t.total}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
              {tasks.length === 0 && (
                <li className="p-5 text-sm text-gray-500">Nothing shared in this programme.</li>
              )}
            </ul>
          )}
        </section>
      )}

      {openTask && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-medium text-gray-900">{openTask.name}</h2>
            <button onClick={() => { setOpenTask(null); setRecords(null); }}
                    className="text-xs text-gray-500 hover:text-gray-800">Close</button>
          </header>
          {!records ? (
            <p className="p-5 text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-2">School</th>
                    {records.some((r) => r.student_name) && <th className="px-5 py-2">Student</th>}
                    <th className="px-5 py-2">Status</th>
                    <th className="px-5 py-2">Completed by</th>
                    <th className="px-5 py-2">Period</th>
                    <th className="px-5 py-2">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2">
                        {r.school_name ?? "—"}
                        {r.school_district && (
                          <span className="ml-1 text-xs text-gray-500">{r.school_district}</span>
                        )}
                      </td>
                      {records.some((x) => x.student_name) && (
                        <td className="px-5 py-2">{r.student_name ?? "—"}</td>
                      )}
                      <td className="px-5 py-2">{r.status}</td>
                      <td className="px-5 py-2">{r.completed_by ?? "—"}</td>
                      <td className="px-5 py-2 text-gray-600">{r.period_key ?? "—"}</td>
                      <td className="px-5 py-2">
                        {r.photo_count + r.geo_count > 0 ? (
                          <button onClick={() => openProofs(r)}
                                  className="text-teal-700 underline hover:text-teal-900">
                            {r.photo_count} photo{r.photo_count === 1 ? "" : "s"}
                            {r.geo_count > 0 && ", location"}
                          </button>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-4 text-gray-500">
                      No records yet — this task has been shared but not yet assigned.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {proofsFor && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-medium text-gray-900">
              Evidence — {proofsFor.school_name ?? "record"}
            </h2>
            <button onClick={() => { setProofsFor(null); setProofs(null); }}
                    className="text-xs text-gray-500 hover:text-gray-800">Close</button>
          </header>
          {!proofs ? (
            <p className="p-5 text-sm text-gray-500">Loading…</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {proofs.map((p) => (
                <li key={p.id} className="px-5 py-3 text-sm">
                  <div className="font-medium text-gray-900">{p.kind}</div>
                  <div className="text-xs text-gray-600">
                    {p.captured_at ? new Date(p.captured_at).toLocaleString() : "no capture time"}
                    {p.lat != null && p.lng != null && (
                      <> · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        {p.accuracy_m != null && <> (±{p.accuracy_m}m)</>}
                      </>
                    )}
                  </div>
                  {/* The location was read from the photo's own metadata, which the
                      person taking it can edit. Saying so where the coordinates are
                      shown, rather than in a footnote, is the difference between
                      evidence and a claim of proof. */}
                  <p className="mt-1 text-xs text-gray-500">
                    Captured by the {IN_CHARGE.toLowerCase()} on their phone. Location comes from
                    the photo&apos;s metadata — it is evidence, not proof of physical presence.
                  </p>
                </li>
              ))}
              {proofs.length === 0 && (
                <li className="px-5 py-4 text-sm text-gray-500">No evidence attached.</li>
              )}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
