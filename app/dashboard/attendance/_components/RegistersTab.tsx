"use client";

/**
 * Stream 2 staff view: printable sheet, photo upload, pending reviews.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { fetchSchools } from "@/lib/api";
import { peekRegister } from "@/lib/attendance-api";
import { matchSchoolGuess } from "@/lib/school-fuzzy-match";
import {
  useRegisterUploads,
  useRegisterUpload,
  useUploadRegister,
  useDeleteRegister,
} from "@/lib/queries/attendance";
import { SchoolSearchPicker } from "@/components/SchoolSearchPicker";
import { ReviewGrid } from "./ReviewGrid";

/** House primary button — mirrors the gradient CTA used across the dashboard. */
const PRIMARY_BTN =
  "rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 " +
  "bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]";

const MAX_REGISTER_PAGES = 3;

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function pickFiles(fileList: FileList | null): File[] {
  const files = fileList ? Array.from(fileList) : [];
  if (files.length === 0) return [];
  const firstIsImage = files[0].type.startsWith("image/");
  return firstIsImage ? files.slice(0, MAX_REGISTER_PAGES) : [files[0]];
}

export function RegistersTab({ canManage }: { canManage: boolean }) {
  const [schoolId, setSchoolId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [openUploadId, setOpenUploadId] = useState<string | null>(null);
  const peekAbortRef = useRef<AbortController | null>(null);

  // Only the manage-only controls below use this list, so don't fetch (and don't
  // surface a permission error) for a view-only user who can't act on it anyway.
  const { data: schools, isError: schoolsFailed, isLoading: schoolsLoading } = useQuery({
    queryKey: ["og", "schools", "options"],
    queryFn: fetchSchools,
    staleTime: 5 * 60_000,
    enabled: canManage,
  });
  const { data: uploads, isLoading } = useRegisterUploads(schoolId ? { school_id: schoolId } : {});
  const { data: openUpload } = useRegisterUpload(openUploadId);
  const upload = useUploadRegister();
  const deleteUpload = useDeleteRegister();

  function onFilesChosen(fileList: FileList | null) {
    const picked = pickFiles(fileList);
    setImages(picked);
    if (picked.length === 0) return;

    peekAbortRef.current?.abort();
    const controller = new AbortController();
    peekAbortRef.current = controller;

    peekRegister(picked[0], controller.signal)
      .then((guess) => {
        if (controller.signal.aborted) return;
        if (!schoolId && guess.school_guess) {
          const match = matchSchoolGuess(guess.school_guess, schools ?? []);
          if (match) setSchoolId(match.id);
        }
        if (!periodStart && guess.period_start_guess) setPeriodStart(guess.period_start_guess);
        if (!periodEnd && guess.period_end_guess) setPeriodEnd(guess.period_end_guess);
      })
      .catch(() => {
        // Best-effort only — a failed peek just means no prefill, never an error shown to the user.
      });
  }

  const doUpload = () => {
    if (!schoolId || !periodStart || !periodEnd || images.length === 0) {
      toast.error("Pick a school, period and file(s) first.");
      return;
    }
    upload.mutate(
      { school_id: schoolId, period_start: periodStart, period_end: periodEnd, images },
      {
        onSuccess: (detail) => {
          toast.success("Uploaded — review the extracted grid");
          setImages([]);
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
          <h3
            className="font-semibold text-[var(--dark-teal)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Working on
          </h3>
          {schoolsFailed ? (
            <p className="mt-2 text-sm text-red-600">
              Can&apos;t load the school list — your role may not have permission to view schools.
              Ask an admin.
            </p>
          ) : (
            <div className="mt-2 max-w-md">
              <SchoolSearchPicker
                schools={schools ?? []}
                value={schoolId}
                onChange={setSchoolId}
                disabled={schoolsLoading}
                placeholder={schoolsLoading ? "Loading schools…" : "Search school by name, code or district…"}
              />
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3
            className="font-semibold text-[var(--dark-teal)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Printable sheet
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Print a pre-filled register for the school; the teacher marks P/A per class day and
            writes the date in each column header.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  ? "text-white bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]"
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
          <h3
            className="font-semibold text-[var(--dark-teal)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Upload register
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">Period</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <span className="text-slate-400">→</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.pdf,.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => onFilesChosen(e.target.files)}
              className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            <button
              disabled={upload.isPending}
              onClick={doUpload}
              className={PRIMARY_BTN}
            >
              {upload.isPending ? "Extracting…" : "Upload & extract"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Photo (JPEG/PNG/WebP/HEIC — pick up to 3 pages), PDF, CSV or Excel, max 10 MB per file.
            Spreadsheets are read directly; photos and PDFs go through extraction. Either way you
            review and correct before anything is saved.
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
        <h3
          className="font-semibold text-[var(--dark-teal)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Uploads
        </h3>
        {isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (uploads ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {schoolId ? "No uploads for this school yet." : "No uploads yet."}
          </p>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {(uploads ?? []).map((u) => (
              <div
                key={u.id}
                onClick={() => setOpenUploadId(u.id)}
                className="w-full flex flex-wrap items-center gap-2 py-2 text-left hover:bg-slate-50 rounded-lg px-2 cursor-pointer"
              >
                <span className="text-sm font-medium text-[var(--dark-teal)]">{u.school_name}</span>
                <span className="text-xs text-slate-500">{u.period_start} → {u.period_end}</span>
                <span className="flex-1" />
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  u.status === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700"
                  : u.status === "COMMITTED" ? "bg-green-100 text-green-700"
                  : "bg-slate-100 text-slate-500"
                }`}>{u.status.replace("_", " ")}</span>
                {u.status !== "COMMITTED" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(
                        `Permanently delete this upload (${u.school_name}, ${u.period_start} → ${u.period_end})? This cannot be undone.`,
                      )) return;
                      deleteUpload.mutate(u.id, {
                        onSuccess: () => {
                          toast.success("Upload deleted");
                          if (openUploadId === u.id) setOpenUploadId(null);
                        },
                        onError: (e) => toast.error(e.message),
                      });
                    }}
                    disabled={deleteUpload.isPending}
                    title="Delete upload"
                    className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
