"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePartnerRecords, usePartnerProofs } from "@/lib/queries/tracker";
import type { PartnerRecord, PartnerTaskRow } from "@/lib/tracker-api";
import { IN_CHARGE_LOWER } from "@/lib/labels";

const STATE_LABEL: Record<string, string> = {
  done: "Done", in_progress: "In progress", not_started: "Not started",
  overdue: "Overdue", blocked: "Blocked",
};
const STATE_TONE: Record<string, string> = {
  done: "bg-teal-50 text-teal-800", in_progress: "bg-blue-50 text-blue-800",
  not_started: "bg-gray-100 text-gray-600", overdue: "bg-amber-50 text-amber-800",
  blocked: "bg-red-50 text-red-800",
};

/** Records of one shared task, paginated — all-history makes this the long list. */
export function PartnerRecords({ task, scope, filters }: {
  task: PartnerTaskRow;
  scope: { state?: string; district?: string; schoolId?: string; studentId?: string };
  filters: Record<string, unknown>;
}) {
  const [page, setPage] = useState(1);
  // Page 3 of one school is not page 3 of the next. Without this an official who
  // drills sideways lands on an empty page and reads it as "no records".
  const scopeKey = JSON.stringify({ scope, filters, t: task.template_id });
  useEffect(() => { setPage(1); }, [scopeKey]);
  const [openProofs, setOpenProofs] = useState<PartnerRecord | null>(null);
  const { data, isLoading } = usePartnerRecords(task.template_id, { ...filters, ...scope, page });

  const rows = data?.rows ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const anyStudent = rows.some((r) => r.student_name);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">School</th>
              {anyStudent && <th className="px-4 py-2">Student</th>}
              <th className="px-4 py-2">Status</th>
              {/* Not "Completed by". tracker_records has no completion columns —
                  only updated_by — so on a record an in-charge filled and a
                  manager later corrected, this names the manager. */}
              <th className="px-4 py-2">Last updated by</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-6 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-teal-600" aria-hidden="true" />
              </td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-gray-500">
                No records match these filters.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  {r.school_name ?? <span className="text-gray-400">—</span>}
                  {r.school_district && (
                    <span className="ml-1 text-xs text-gray-500">{r.school_district}</span>
                  )}
                </td>
                {anyStudent && <td className="px-4 py-2">{r.student_name ?? "—"}</td>}
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_TONE[r.lifecycle] ?? ""}`}>
                    {STATE_LABEL[r.lifecycle] ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-2">{r.last_updated_by ?? "—"}</td>
                <td className="px-4 py-2 text-gray-600">{r.period_key ?? "—"}</td>
                <td className="px-4 py-2">
                  {r.photo_count + r.geo_count > 0 ? (
                    <button onClick={() => setOpenProofs(r)} className="text-teal-700 underline hover:text-teal-900">
                      {r.photo_count} photo{r.photo_count === 1 ? "" : "s"}
                      {r.geo_count > 0 && ", location"}
                    </button>
                  ) : <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                    className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40">Previous</button>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)}
                    className="rounded-md border border-gray-200 px-3 py-1 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {openProofs && <ProofPanel record={openProofs} onClose={() => setOpenProofs(null)} />}
    </div>
  );
}

/**
 * The evidence on one record.
 *
 * The image is fetched from a short-lived signed URL minted per request behind the
 * same gate as the row. `referrerPolicy="no-referrer"` so the storage host is never
 * told which page the official was reading.
 */
function ProofPanel({ record, onClose }: { record: PartnerRecord; onClose: () => void }) {
  const { data: proofs, isLoading } = usePartnerProofs(record.id);

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <h3 className="text-sm font-medium text-gray-900">
          Evidence — {record.school_name ?? record.student_name ?? "record"}
        </h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-900">Close</button>
      </header>
      {isLoading ? (
        <p className="p-4 text-sm text-gray-500">Loading…</p>
      ) : !proofs?.length ? (
        <p className="p-4 text-sm text-gray-500">No evidence attached.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {proofs.map((p) => (
            <li key={p.id} className="flex gap-4 px-4 py-3 text-sm">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt="Proof photograph"
                  referrerPolicy="no-referrer"
                  className="h-24 w-24 shrink-0 rounded object-cover"
                />
              )}
              <div>
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
                    shown is the difference between evidence and a claim of proof. */}
                <p className="mt-1 text-xs text-gray-500">
                  Captured by the {IN_CHARGE_LOWER} on their phone. Location comes from the
                  photo&apos;s metadata — it is evidence, not proof of physical presence.
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
