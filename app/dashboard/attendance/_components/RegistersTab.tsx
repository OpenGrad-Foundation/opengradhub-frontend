"use client";

/**
 * Stream 2 staff view: printable sheet, then upload → preview → commit.
 *
 * There is no upload history: a draft exists to be reviewed and committed, and
 * a list of past uploads was a second way to reach the same grid rather than
 * anything anyone needed. The draft returned by the upload is held here and
 * handed straight to the review grid, which owns it until it is committed or
 * discarded.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchSchools } from "@/lib/api";
import { useUploadRegister } from "@/lib/queries/attendance";
import type { UploadDetail } from "@/lib/attendance-api";
import { SchoolSearchPicker } from "@/components/SchoolSearchPicker";
import { ReviewGrid } from "./ReviewGrid";

/** House primary button — mirrors the gradient CTA used across the dashboard. */
const PRIMARY_BTN =
  "rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50 " +
  "bg-[linear-gradient(135deg,#0abe62_0%,#006d6c_100%)] shadow-[0_4px_12px_rgba(10,190,98,0.2)]";

export function RegistersTab({ canManage }: { canManage: boolean }) {
  const [schoolId, setSchoolId] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [draft, setDraft] = useState<UploadDetail | null>(null);

  // Only the manage-only controls below use this list, so don't fetch (and don't
  // surface a permission error) for a view-only user who can't act on it anyway.
  const { data: schools, isError: schoolsFailed, isLoading: schoolsLoading } = useQuery({
    queryKey: ["og", "schools", "options"],
    queryFn: fetchSchools,
    staleTime: 5 * 60_000,
    enabled: canManage,
  });
  const upload = useUploadRegister();

  /**
   * Preselect the school the dashboard's gap widget sent us to.
   *
   * Applied only once the school list has arrived and only if the id is really
   * in it: an id from a stale link or a hand-edited URL would otherwise leave
   * the picker holding a value it can't display, which looks like a selection
   * but uploads nowhere. No match, no selection — the user picks manually.
   * `useSearchParams` needs no Suspense boundary here; the shared Tabs component
   * already renders these panels inside one.
   */
  const requestedSchoolId = useSearchParams().get("school_id");
  const preselected = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedSchoolId || !schools) return;
    // Once per id. The effect re-runs whenever the schools query refetches, and
    // without this a background refetch would drag the picker back to the URL's
    // school after the user had deliberately chosen a different one — sending
    // the next upload to the wrong school.
    if (preselected.current === requestedSchoolId) return;
    if (schools.some((s) => s.id === requestedSchoolId)) {
      preselected.current = requestedSchoolId;
      setSchoolId(requestedSchoolId);
    }
  }, [requestedSchoolId, schools]);

  const doUpload = () => {
    if (!schoolId || !image) {
      toast.error("Pick a school and a file first.");
      return;
    }
    upload.mutate(
      { school_id: schoolId, image },
      {
        onSuccess: (detail) => {
          toast.success("Uploaded — review the extracted grid");
          setImage(null);
          setDraft(detail);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (!canManage) {
    return (
      <p className="text-sm text-slate-500">
        You can view attendance totals in the Overview tab. Uploading a register needs the
        attendance manage permission.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3
          className="font-semibold text-[var(--dark-teal)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Printable sheet
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Print a pre-filled register for the school. The month and the day numbers are both left
          blank for the school to write in — they are read back off the sheet when you upload it.
        </p>
        {schoolsFailed ? (
          <p className="mt-2 text-sm text-red-600">
            Can&apos;t load the school list — your role may not have permission to view schools.
            Ask an admin.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="min-w-[260px] flex-1">
              <SchoolSearchPicker
                schools={schools ?? []}
                value={schoolId}
                onChange={setSchoolId}
                disabled={schoolsLoading}
                placeholder={schoolsLoading ? "Loading schools…" : "Search school by name, code or district…"}
              />
            </div>
            <Link
              href={schoolId ? `/dashboard/attendance/sheet?school_id=${encodeURIComponent(schoolId)}` : "#"}
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
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3
          className="font-semibold text-[var(--dark-teal)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Upload register
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/*,application/pdf,.pdf,.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
          <button disabled={upload.isPending} onClick={doUpload} className={PRIMARY_BTN}>
            {upload.isPending ? "Extracting…" : "Upload & extract"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Uses the school selected above. Photo (JPEG/PNG/WebP/HEIC), PDF, CSV or Excel, max
          10 MB. Spreadsheets are read directly and still need full dates in their headers; photos
          and PDFs go through extraction, which reads the handwritten month. Either way you review
          and correct before anything is saved.
        </p>
      </div>

      {draft ? (
        <ReviewGrid
          upload={draft}
          onChange={setDraft}
          onDone={() => setDraft(null)}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
          Upload a register to review it here.
        </div>
      )}
    </div>
  );
}
