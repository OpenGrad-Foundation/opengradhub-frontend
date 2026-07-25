"use client";

/**
 * Stream 2 staff view: printable sheet, photo upload, pending reviews.
 */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchSchools } from "@/lib/api";
import {
  useRegisterUploads,
  useRegisterUpload,
  useUploadRegister,
} from "@/lib/queries/attendance";
import { ReviewGrid } from "./ReviewGrid";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function RegistersTab({ canManage }: { canManage: boolean }) {
  const [schoolId, setSchoolId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [openUploadId, setOpenUploadId] = useState<string | null>(null);

  const { data: schools } = useQuery({
    queryKey: ["og", "schools", "options"],
    queryFn: fetchSchools,
    staleTime: 5 * 60_000,
  });
  const { data: uploads, isLoading } = useRegisterUploads(schoolId ? { school_id: schoolId } : {});
  const { data: openUpload } = useRegisterUpload(openUploadId);
  const upload = useUploadRegister();

  const doUpload = () => {
    if (!schoolId || !periodStart || !periodEnd || !image) {
      toast.error("Pick a school, period and photo first.");
      return;
    }
    upload.mutate(
      { school_id: schoolId, period_start: periodStart, period_end: periodEnd, image },
      {
        onSuccess: (detail) => {
          toast.success("Uploaded — review the extracted grid");
          setImage(null);
          setOpenUploadId(detail.id);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-800">Printable sheet</h3>
          <p className="mt-1 text-xs text-slate-500">
            Print a pre-filled register for the school; the teacher marks P/A per class day and
            writes the date in each column header.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">Select school…</option>
              {(schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <Link
              href={schoolId ? `/dashboard/attendance/sheet?school_id=${schoolId}&month=${month}` : "#"}
              aria-disabled={!schoolId}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                schoolId
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-slate-200 text-slate-400 pointer-events-none"
              }`}
            >
              Open printable sheet
            </Link>
          </div>
        </div>
      )}

      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-800">Upload register photo</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Period</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <span className="text-slate-400">→</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            <button
              disabled={upload.isPending}
              onClick={doUpload}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {upload.isPending ? "Extracting…" : "Upload & extract"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Uses the school selected above. JPEG/PNG/WebP/HEIC, max 10 MB. Extraction runs
            immediately; you review and correct before anything is saved.
          </p>
        </div>
      )}

      {openUpload && (
        <ReviewGrid
          key={openUpload.id + openUpload.status}
          upload={openUpload}
          onDone={() => setOpenUploadId(null)}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-800">Uploads</h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (uploads ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {schoolId ? "No uploads for this school yet." : "No uploads yet."}
          </p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {(uploads ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setOpenUploadId(u.id)}
                className="w-full flex flex-wrap items-center gap-2 py-2 text-left hover:bg-slate-50 rounded-lg px-2"
              >
                <span className="text-sm font-medium text-slate-800">{u.school_name}</span>
                <span className="text-xs text-slate-500">{u.period_start} → {u.period_end}</span>
                <span className="flex-1" />
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  u.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700"
                  : u.status === "COMMITTED" ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-500"
                }`}>{u.status.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
