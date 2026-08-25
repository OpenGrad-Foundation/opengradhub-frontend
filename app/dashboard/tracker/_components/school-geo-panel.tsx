"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, Loader2, MapPin, ShieldAlert, TriangleAlert } from "lucide-react";
import {
  useOverrideGeoVerification,
  useTemplateGeoVerifications,
  useUploadGeoVerification,
} from "@/lib/queries/tracker";
import type {
  GeoRejectionReason, TrackerGeoVerification, TrackerGridRow, TrackerTemplate,
} from "@/lib/tracker-api";

type School = { id: string; name: string };

/**
 * ONE school-visit verification panel for the whole task, sitting above the grid.
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
export function SchoolGeoPanel({
  template,
  rows,
  schoolFilter,
  onSchoolFilterChange,
  canFill,
  readOnly = false,
  canOverride = false,
}: {
  template: TrackerTemplate;
  rows: TrackerGridRow[];
  /** The grid's shared school filter (by name), so the fellow picks a school once. */
  schoolFilter: string;
  onSchoolFilterChange: (name: string) => void;
  canFill: boolean;
  readOnly?: boolean;
  canOverride?: boolean;
}) {
  const enabled = Boolean(template.require_geo_verification);
  const { data, isLoading } = useTemplateGeoVerifications(template.id, enabled);
  const upload = useUploadGeoVerification(template.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);

  const schools = useMemo<School[]>(() => {
    const seen = new Map<string, School>();
    for (const r of rows) {
      if (r.school_id && r.school_name && !seen.has(r.school_id)) {
        seen.set(r.school_id, { id: r.school_id, name: r.school_name });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const bySchool = useMemo(() => {
    const map = new Map<string, TrackerGeoVerification>();
    // Newest first from the API; keep the accepted one if there is one, else the latest.
    for (const v of data ?? []) {
      const existing = map.get(v.school_id);
      if (!existing || (v.accepted && !existing.accepted)) map.set(v.school_id, v);
    }
    return map;
  }, [data]);

  if (!enabled) return null;

  const selected =
    schools.length === 1 ? schools[0] : schools.find((s) => s.name === schoolFilter) ?? null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || !selected) return;
    setError(null);
    try {
      // Sent RAW. Any client-side resize would strip the EXIF this feature reads.
      await upload.mutateAsync({ schoolId: selected.id, file });
    } catch (err) {
      setError(messageFor(err));
    }
  }

  const rowsForSchool = (schoolId: string) => rows.filter((r) => r.school_id === schoolId).length;
  const hasPhoto = Boolean(selected && bySchool.get(selected.id));

  return (
    <section
      role="region"
      aria-label="School visit verification"
      className="border-b border-gray-100 bg-gray-50/60 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-teal-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-900">School visit verification</h3>
        </div>
        <p className="text-xs text-gray-500">
          One photo covers all {template.target_type === "student" ? "students" : "entries"} for this school.
        </p>
      </div>

      <p className="mt-1 text-xs text-gray-500">
        Take the photo at the school with location switched on, or upload one you took there
        earlier. We read the location the camera saved inside the photo — we never ask your
        browser for your location.
      </p>

      {isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading verification…
        </p>
      ) : schools.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">No schools in view.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {schools.map((school) => {
            const v = bySchool.get(school.id);
            const isSelected = selected?.id === school.id;
            return (
              <div
                key={school.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 ${
                  isSelected && schools.length > 1
                    ? "border-teal-300 bg-white"
                    : "border-gray-200 bg-white/70"
                }`}
              >
                {schools.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => onSchoolFilterChange(school.name)}
                    className="text-sm font-medium text-gray-900 underline-offset-2 hover:underline"
                  >
                    {school.name}
                  </button>
                ) : (
                  <span className="text-sm font-medium text-gray-900">{school.name}</span>
                )}

                <StateBadge verification={v} />

                {v && (
                  <span className="text-xs text-gray-500">
                    {formatDistance(v.distance_m)} from school · captured {formatTime(v.exif_captured_at)}
                    {v.accuracy_m == null ? " · accuracy not reported" : ` · ±${Math.round(v.accuracy_m)} m`}
                  </span>
                )}

                <span className="text-xs text-gray-400">
                  {rowsForSchool(school.id)} {rowsForSchool(school.id) === 1 ? "entry" : "entries"}
                </span>

                {v?.preview_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.preview_url}
                    alt={`Visit photo for ${school.name}`}
                    className="h-10 w-10 rounded border border-gray-200 object-cover"
                  />
                )}

                {v?.override_reason && (
                  <span className="w-full text-xs text-amber-800">
                    Overridden: {v.override_reason}
                  </span>
                )}

                {canOverride && v && v.status === "outside_radius" && !v.accepted && (
                  <button
                    type="button"
                    onClick={() => setOverrideFor(overrideFor === v.id ? null : v.id)}
                    className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                  >
                    Override
                  </button>
                )}

                {overrideFor === v?.id && v && (
                  <OverrideForm verificationId={v.id} onDone={() => setOverrideFor(null)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && canFill && schools.length > 0 && (
        <div className="mt-3">
          {selected ? (
            <>
              {upload.isPending ? (
                <p className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking photo…
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Two deliberate routes to the same upload. `capture` hands off to the
                      phone's OWN camera app, which writes GPS into the file's EXIF. A
                      camera opened inside the browser (getUserMedia + canvas) would
                      produce a JPEG with no EXIF at all and could never be verified. */}
                  <label
                    htmlFor="geo-photo-camera"
                    className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    {hasPhoto ? "Retake photo" : "Take photo"}
                  </label>
                  <label
                    htmlFor="geo-photo-library"
                    className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                    Choose existing photo
                  </label>
                </div>
              )}
              <input
                id="geo-photo-camera"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                capture="environment"
                onChange={onPick}
                className="sr-only"
                aria-label="Take visit photo with the camera"
              />
              <input
                id="geo-photo-library"
                ref={fileRef}
                type="file"
                // No `capture` here on purpose: a photo taken earlier must still be
                // uploadable, which is an explicit requirement of this flow.
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                onChange={onPick}
                className="sr-only"
                aria-label="Choose an existing photo"
              />
              <p className="mt-2 text-xs text-gray-500">
                Switch location on for your camera before taking the photo — we read the
                location the camera saves inside the file.
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-600">
              Choose a school above to add its visit photo.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </section>
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
