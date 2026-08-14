"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, MapPin, X } from "lucide-react";
import {
  useCaptureProofLocation,
  useDeleteProofPhoto,
  useTrackerProofs,
  useUploadProofPhoto,
} from "@/lib/queries/tracker";

/** Downscale a captured image to a max edge and re-encode as JPEG to keep field uploads
 *  small. Fails OPEN: on any decode/canvas error, send the original file rather than
 *  blocking the upload (some browsers can't decode e.g. HEIC into an ImageBitmap). */
export async function downscaleImage(file: File, maxEdge = 1600): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file; // no canvas -> send original
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // decode/canvas failure -> send the original rather than losing the photo
  } finally {
    bitmap?.close();
  }
}

export function RecordProofs({
  recordId,
  requirePhoto,
  requireLocation,
  editable,
  onReadyChange,
}: {
  recordId: string;
  requirePhoto: boolean;
  requireLocation: boolean;
  editable: boolean;
  onReadyChange?: (ready: boolean) => void;
}) {
  const { data, isLoading } = useTrackerProofs(recordId, requirePhoto || requireLocation);
  const upload = useUploadProofPhoto(recordId);
  const capture = useCaptureProofLocation(recordId);
  const del = useDeleteProofPhoto(recordId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const photos = data?.photos ?? [];
  const location = data?.location ?? null;
  const ready = (!requirePhoto || photos.length > 0) && (!requireLocation || location !== null);

  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);

  if (!requirePhoto && !requireLocation) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setErr(null);
    try {
      const blob = await downscaleImage(file);
      await upload.mutateAsync(blob);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Could not upload the photo.");
    }
  }

  function onCaptureLocation() {
    setErr(null);
    if (!("geolocation" in navigator)) { setErr("Location is not available on this device."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await capture.mutateAsync({
            lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy_m: pos.coords.accuracy,
          });
        } catch (x) {
          setErr(x instanceof Error ? x.message : "Could not save your location.");
        } finally { setLocating(false); }
      },
      (geoErr) => {
        setLocating(false);
        setErr(geoErr.code === geoErr.PERMISSION_DENIED
          ? "Location permission denied — enable it in your browser to continue."
          : "Could not get your location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50/60 p-3">
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading proof…</div>
      ) : (
        <>
          {requirePhoto && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-700">Photo{editable ? " (required)" : ""}</p>
              <div className="flex flex-wrap gap-2">
                {photos.map((ph) => (
                  <div key={ph.id} className="relative">
                    { /* eslint-disable-next-line @next/next/no-img-element */ }
                    <img src={ph.url} alt="Proof" className="h-20 w-20 rounded-md border border-gray-200 object-cover" />
                    {editable && (
                      <button type="button" onClick={() => del.mutate(ph.id)} disabled={del.isPending}
                        aria-label="Remove photo"
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600 disabled:opacity-50">
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                {editable && photos.length < 5 && (
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.isPending}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-teal-400 hover:text-teal-600 disabled:opacity-50">
                    {upload.isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Camera className="h-5 w-5" aria-hidden="true" />}
                    Take photo
                  </button>
                )}
                {!editable && photos.length === 0 && <p className="text-xs text-gray-400">No photo</p>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />
            </div>
          )}

          {requireLocation && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-700">Location{editable ? " (required)" : ""}</p>
              {location ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {location.accuracy_m != null ? `±${Math.round(location.accuracy_m)}m` : "captured"} · {formatTime(location.captured_at)}
                  </span>
                  <a href={`https://maps.google.com/?q=${location.lat},${location.lng}`} target="_blank" rel="noreferrer"
                    className="font-medium text-teal-600 underline">View on map</a>
                  {editable && (
                    <button type="button" onClick={onCaptureLocation} disabled={locating}
                      className="text-gray-500 underline hover:text-gray-700 disabled:opacity-50">Recapture</button>
                  )}
                </div>
              ) : editable ? (
                <button type="button" onClick={onCaptureLocation} disabled={locating}
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
                  Capture location
                </button>
              ) : (
                <p className="text-xs text-gray-400">No location</p>
              )}
            </div>
          )}

          {err && <p className="text-xs text-red-700">{err}</p>}
        </>
      )}
    </div>
  );
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
