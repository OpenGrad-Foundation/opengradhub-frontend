"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera, Check, Image as ImageIcon, Loader2, MapPin, ShieldAlert, TriangleAlert, X,
} from "lucide-react";
import {
  useOverrideGeoVerification,
  useTemplateGeoVerifications,
  useUploadGeoVerification,
} from "@/lib/queries/tracker";
import type {
  GeoRejectionReason, TrackerGeoVerification, TrackerGridRow, TrackerTemplate,
} from "@/lib/tracker-api";

/**
 * A visit is owed per school BY A PERSON: the server stores one verification per
 * (template, period, school, doer), and a row completes only on its own doer's photo. A
 * manager's grid can hold two In-Charges' rows for the same school, so the unit here is the
 * pair, never the school alone — collapsing them showed one person's photo as covering the
 * other's rows.
 */
type VisitTarget = {
  key: string;
  schoolId: string;
  schoolName: string;
  doerId: string | null;
  doerName: string | null;
  /** Uploading is doer-only, so only the viewer's own rows offer it. */
  canUpload: boolean;
};

const targetKey = (schoolId: string, doerId: string | null | undefined) => `${schoolId}::${doerId ?? ""}`;

export function visitTargetsOf(rows: TrackerGridRow[]): VisitTarget[] {
  const seen = new Map<string, VisitTarget>();
  for (const r of rows) {
    if (!r.school_id || !r.school_name) continue;
    const key = targetKey(r.school_id, r.doer_id);
    const existing = seen.get(key);
    if (existing) {
      existing.canUpload = existing.canUpload || r.can_evidence === true;
      continue;
    }
    seen.set(key, {
      key, schoolId: r.school_id, schoolName: r.school_name,
      doerId: r.doer_id ?? null, doerName: r.doer_name ?? null,
      canUpload: r.can_evidence === true,
    });
  }
  return [...seen.values()].sort((a, b) =>
    a.schoolName.localeCompare(b.schoolName) || (a.doerName ?? "").localeCompare(b.doerName ?? ""));
}

/** The verification that counts for each (school, doer): the accepted one, else the latest. */
function byTargetOf(data: TrackerGeoVerification[] | undefined) {
  const map = new Map<string, TrackerGeoVerification>();
  // Newest first from the API; keep the accepted one if there is one, else the latest.
  for (const v of data ?? []) {
    const key = targetKey(v.school_id, v.doer_id);
    const existing = map.get(key);
    if (!existing || (v.accepted && !existing.accepted)) map.set(key, v);
  }
  return map;
}

/**
 * Toolbar summary for the whole task: how many of its schools have an accepted visit.
 *
 * The detail lives behind the modal rather than in a band above the grid — a fellow
 * with one school does not need a permanent panel, and a manager with eight does not
 * want one.
 */
export function GeoStatusChip({
  template,
  rows,
  onOpen,
}: {
  template: TrackerTemplate;
  rows: TrackerGridRow[];
  onOpen: () => void;
}) {
  const enabled = Boolean(template.require_geo_verification);
  const { data } = useTemplateGeoVerifications(template.id, enabled);
  const targets = useMemo(() => visitTargetsOf(rows), [rows]);
  const byTarget = useMemo(() => byTargetOf(data), [data]);

  if (!enabled) return null;

  // Counted per (school, doer): a school two In-Charges work is two visits owed, not one.
  const verified = targets.filter((t) => byTarget.get(t.key)?.accepted).length;
  const allDone = targets.length > 0 && verified === targets.length;
  const tone = allDone
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Visit verification"
      title="School visit verification"
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${tone}`}
    >
      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
      Visit verification
      <span className="font-semibold">
        {verified}/{targets.length}
      </span>
    </button>
  );
}

/**
 * The school-visit verification, as a centred dialog.
 *
 * The verification is shared: a single photo covers every row for the same school,
 * period and doer, so this deliberately does NOT live inside a row.
 *
 * Location comes from the photo's own EXIF, parsed server-side. The browser is never
 * asked for location permission. The "Take photo" button hands off to the phone's
 * native camera app (capture="environment") precisely because that app writes GPS into
 * the file; a camera opened inside the page via getUserMedia would yield a canvas JPEG
 * with no EXIF, which this check could never accept.
 */
export function GeoVerificationModal({
  template,
  rows,
  initialSchoolId,
  blocking = false,
  canFill,
  readOnly = false,
  canOverride = false,
  onClose,
}: {
  template: TrackerTemplate;
  rows: TrackerGridRow[];
  /** The school whose missing verification blocked a row, if the gate opened this. */
  initialSchoolId?: string | null;
  /** True when a blocked "mark done" opened this, rather than the toolbar chip. */
  blocking?: boolean;
  canFill: boolean;
  readOnly?: boolean;
  canOverride?: boolean;
  onClose: () => void;
}) {
  const enabled = Boolean(template.require_geo_verification);
  const { data, isLoading } = useTemplateGeoVerifications(template.id, enabled);
  const upload = useUploadGeoVerification(template.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busySchoolId, setBusySchoolId] = useState<string | null>(null);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const targets = useMemo(() => {
    const all = visitTargetsOf(rows);
    if (!initialSchoolId) return all;
    // The school that blocked the row goes first — it is why the fellow is here.
    return [...all].sort((a, b) =>
      a.schoolId === initialSchoolId ? -1 : b.schoolId === initialSchoolId ? 1 : 0);
  }, [rows, initialSchoolId]);
  const byTarget = useMemo(() => byTargetOf(data), [data]);

  if (!enabled) return null;

  async function onPick(schoolId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setErrors((s) => ({ ...s, [schoolId]: "" }));
    setBusySchoolId(schoolId);
    try {
      // Sent RAW. Any client-side resize would strip the EXIF this feature reads.
      const result = await upload.mutateAsync({ schoolId, file });
      // Only the gate closes itself, and only once the school it blocked on passes.
      // An out-of-range result stays on screen: the fellow has to see why it failed.
      if (blocking && schoolId === initialSchoolId && result?.accepted) onClose();
    } catch (err) {
      setErrors((s) => ({ ...s, [schoolId]: messageFor(err) }));
    } finally {
      setBusySchoolId(null);
    }
  }

  const rowsForTarget = (t: VisitTarget) =>
    rows.filter((r) => r.school_id === t.schoolId && (r.doer_id ?? null) === t.doerId).length;
  const entryWord = template.target_type === "student" ? "students" : "entries";
  /**
   * A photo is only worth taking while some row it would cover can still be completed.
   * Once every open row for the school is overdue, nothing but a manager's extension
   * reopens them, so the upload is withdrawn rather than left there to gather evidence
   * that cannot be used. A row that is merely `done` does not withdraw it: replacing the
   * photo behind a finished visit is still legitimate.
   */
  const inTime = (t: VisitTarget) =>
    rows.some((r) => r.school_id === t.schoolId && (r.doer_id ?? null) === t.doerId
      && r.lifecycle !== "overdue");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="School visit verification"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-gray-950">School visit verification</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification"
            className="rounded p-1 text-gray-400 hover:text-gray-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {blocking && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Verify this school visit before you can mark its {entryWord} done.
            </p>
          )}

          <p className="text-xs text-gray-500">
            One photo covers all {entryWord} for this school. Take it at the school with
            location switched on, or upload one you took there earlier. We read the location
            the camera saved inside the photo — we never ask your browser for your location.
          </p>

          {isLoading ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading verification…
            </p>
          ) : targets.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">No schools in view.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {targets.map((school) => {
                const v = byTarget.get(school.key);
                const count = rowsForTarget(school);
                // Uploading is doer-only. A supervisor sees the evidence and may override an
                // out-of-range capture, but may not stand in for the visit itself.
                const mayUpload = canFill && school.canUpload;
                // One upload runs at a time. When the mutation is in flight but this
                // dialog did not start it, fall back to showing it on every card.
                const busy = upload.isPending && (busySchoolId === null || busySchoolId === school.schoolId);
                const outOfTime = !inTime(school);
                return (
                  <section
                    key={school.key}
                    role="group"
                    aria-label={school.doerName ? `${school.schoolName} — ${school.doerName}` : school.schoolName}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-sm font-medium text-gray-900">{school.schoolName}</span>
                      {school.doerName && !school.canUpload && (
                        <span className="text-xs text-gray-500">{school.doerName}&apos;s visit</span>
                      )}
                      <StateBadge verification={v} />
                      <span className="text-xs text-gray-400">
                        {count} {count === 1 ? "entry" : "entries"}
                      </span>
                    </div>

                    {v && (
                      <div className="mt-2 flex items-start gap-3">
                        {v.preview_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={v.preview_url}
                            alt={`Visit photo for ${school.schoolName}`}
                            className="h-14 w-14 shrink-0 rounded border border-gray-200 object-cover"
                          />
                        )}
                        <p className="text-xs text-gray-500">
                          {formatDistance(v.distance_m)} from school · captured{" "}
                          {formatTime(v.exif_captured_at)}
                          {v.accuracy_m == null
                            ? " · accuracy not reported"
                            : ` · ±${Math.round(v.accuracy_m)} m`}
                        </p>
                      </div>
                    )}

                    {v?.override_reason && (
                      <p className="mt-2 text-xs text-amber-800">Overridden: {v.override_reason}</p>
                    )}

                    {!readOnly && mayUpload && outOfTime && (
                      <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        Past its due date, so no new photo can be added. Ask your ZM or PM for an
                        extension — the upload comes back while it lasts.
                      </p>
                    )}

                    {!readOnly && mayUpload && !outOfTime && (
                      <div className="mt-3">
                        {busy ? (
                          <p className="inline-flex items-center gap-2 text-sm text-gray-600">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking photo…
                          </p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Two deliberate routes to the same upload. `capture` hands off to
                                the phone's OWN camera app, which writes GPS into the file's
                                EXIF. A camera opened inside the browser (getUserMedia +
                                canvas) would produce a JPEG with no EXIF at all and could
                                never be verified. */}
                            <label
                              htmlFor={`geo-photo-camera-${school.key}`}
                              className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                            >
                              <Camera className="h-4 w-4" aria-hidden="true" />
                              {v ? "Retake photo" : "Take photo"}
                            </label>
                            <label
                              htmlFor={`geo-photo-library-${school.key}`}
                              className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                              Choose existing photo
                            </label>
                          </div>
                        )}
                        <input
                          id={`geo-photo-camera-${school.key}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                          capture="environment"
                          onChange={(e) => void onPick(school.schoolId, e)}
                          className="sr-only"
                          aria-label={`Take visit photo for ${school.schoolName} with the camera`}
                        />
                        <input
                          id={`geo-photo-library-${school.key}`}
                          type="file"
                          // No `capture` here on purpose: a photo taken earlier must still be
                          // uploadable, which is an explicit requirement of this flow.
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                          onChange={(e) => void onPick(school.schoolId, e)}
                          className="sr-only"
                          aria-label={`Choose an existing photo for ${school.schoolName}`}
                        />
                      </div>
                    )}

                    {canOverride && v && v.status === "outside_radius" && !v.accepted && (
                      <button
                        type="button"
                        onClick={() => setOverrideFor(overrideFor === v.id ? null : v.id)}
                        className="mt-3 rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                      >
                        Override
                      </button>
                    )}

                    {overrideFor === v?.id && v && (
                      <OverrideForm verificationId={v.id} onDone={() => setOverrideFor(null)} />
                    )}

                    {errors[school.schoolId] && (
                      <p className="mt-2 text-xs text-red-700">{errors[school.schoolId]}</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StateBadge({ verification }: { verification: TrackerGeoVerification | undefined }) {
  if (!verification) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        Not uploaded
      </span>
    );
  }
  if (verification.override_by) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Overridden
      </span>
    );
  }
  if (verification.status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5" aria-hidden="true" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> Outside radius
    </span>
  );
}

/** Supervisor override. A reason is mandatory — the backend rejects a blank one too. */
function OverrideForm({ verificationId, onDone }: { verificationId: string; onDone: () => void }) {
  const override = useOverrideGeoVerification();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = reason.trim();
    if (!text) {
      setErr("A reason is required.");
      return;
    }
    setErr(null);
    try {
      await override.mutateAsync({ verificationId, reason: text });
      onDone();
    } catch (x) {
      setErr(messageFor(x));
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Override verification"
      className="mt-2 flex w-full flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2"
    >
      <label htmlFor={`reason-${verificationId}`} className="text-xs font-medium text-gray-700">
        Reason for accepting this visit
      </label>
      <textarea
        id={`reason-${verificationId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-amber-500"
      />
      {err && <p className="text-xs text-red-700">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={override.isPending}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          Confirm override
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Reason codes the fellow can act on; anything else falls back to the server message. */
const REASON_HINTS: Partial<Record<GeoRejectionReason, string>> = {
  no_gps: "Turn on location for your camera, then take a new photo at the school.",
  no_capture_time: "Take a new photo — this one has no capture time saved.",
  accuracy_too_poor: "Try again outdoors, away from the building.",
  outside_period: "Use a photo taken during this task's period.",
};

function messageFor(err: unknown): string {
  const reason = (err as { reason?: GeoRejectionReason })?.reason;
  const base = err instanceof Error ? err.message : "Could not verify that photo.";
  // A school with no coordinates is a SETUP problem, not the fellow's failure — so it
  // never gets a "take another photo" hint.
  const hint = reason ? REASON_HINTS[reason] : undefined;
  return hint ? `${base} ${hint}` : base;
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
