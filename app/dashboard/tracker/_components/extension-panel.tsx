"use client";

import { useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { useGrantExtension, useRecordExtensions } from "@/lib/queries/tracker";
import type { TrackerExtension } from "@/lib/tracker-api";

/**
 * Why an overdue row cannot be completed, and — for a manager — how to reopen it.
 *
 * An overdue record is completable by nobody: not the doer, not through a photo or
 * geo override, not by a super admin. Only a dated extension from a manager above
 * the doer reopens it, and only until that date. So the fellow's copy points at a
 * person rather than at another action they could take alone.
 */
export function ExtensionPanel({
  recordId,
  overdue,
  canGrant,
}: {
  recordId: string;
  overdue: boolean;
  /** Holder of tracker.extension.grant, in scope over the doer. */
  canGrant: boolean;
}) {
  const { data, isLoading } = useRecordExtensions(recordId, overdue);
  const [open, setOpen] = useState(false);
  if (!overdue) return null;

  const grants = data ?? [];
  const live = grants.find((g) => g.active) ?? null;

  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarClock className="h-4 w-4 text-amber-700" aria-hidden="true" />
        <p className="text-sm font-semibold text-amber-900">
          {live ? "Overdue — extended" : "Overdue"}
        </p>
      </div>

      <p className="mt-1 text-xs text-amber-900/80">
        {live
          ? `This task can be completed until ${formatDate(live.extended_to)}.`
          : "This task is past its due date and can no longer be completed. Ask your ZM or PM for an extension."}
      </p>

      {isLoading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading…
        </p>
      ) : grants.length > 0 ? (
        <ol className="mt-2 flex flex-col gap-1">
          {grants.map((g) => (
            <GrantRow key={g.id} grant={g} />
          ))}
        </ol>
      ) : null}

      {canGrant && (
        <div className="mt-2">
          {open ? (
            <GrantForm recordId={recordId} onDone={() => setOpen(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"
            >
              {live ? "Extend again" : "Grant extension"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GrantRow({ grant }: { grant: TrackerExtension }) {
  return (
    <li className="text-xs text-amber-900/90">
      <span className={grant.active ? "font-medium" : "text-gray-500 line-through"}>
        until {formatDate(grant.extended_to)}
      </span>
      {!grant.active && <span className="ml-1 text-gray-500">(expired)</span>}
      {grant.granted_by_name && <span className="text-gray-600"> · {grant.granted_by_name}</span>}
      <span className="text-gray-600"> · {grant.reason}</span>
    </li>
  );
}

/** A grant needs both a date and a reason; the server enforces the same. */
function GrantForm({ recordId, onDone }: { recordId: string; onDone: () => void }) {
  const grant = useGrantExtension();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = reason.trim();
    if (!date) return setErr("Pick a new due date.");
    if (!text) return setErr("A reason is required.");
    setErr(null);
    try {
      await grant.mutateAsync({ recordId, extended_to: date, reason: text });
      onDone();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not grant the extension.");
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Grant extension"
      className="flex flex-col gap-2 rounded-md border border-amber-300 bg-white p-2"
    >
      <label htmlFor={`ext-date-${recordId}`} className="text-xs font-medium text-gray-700">
        New due date
      </label>
      <input
        id={`ext-date-${recordId}`}
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-fit rounded border border-gray-300 px-2 text-xs outline-none focus:border-amber-500"
      />
      <label htmlFor={`ext-reason-${recordId}`} className="text-xs font-medium text-gray-700">
        Reason
      </label>
      <textarea
        id={`ext-reason-${recordId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-amber-500"
      />
      {err && <p className="text-xs text-red-700">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={grant.isPending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          Confirm extension
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function formatDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
