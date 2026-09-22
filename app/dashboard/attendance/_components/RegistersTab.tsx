"use client";
import styles from "../attendance.module.css";
import { ZONE_LOWER } from "@/lib/labels";

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

const PRIMARY_BTN = styles.primary;

/** Mirrors MAX_REGISTER_PAGES in the backend's ingest/limits.ts. */
const MAX_REGISTER_PAGES = 3;

/**
 * A register photographed page by page is several images; a PDF, CSV or Excel
 * file is one whole register on its own and cannot be paired with anything, so
 * only the first is kept. The server enforces both rules — this just stops the
 * picker from offering a selection that is going to be rejected.
 */
function pickFiles(fileList: FileList | null): File[] {
  const files = fileList ? Array.from(fileList) : [];
  if (files.length === 0) return [];
  return files[0].type.startsWith("image/") ? files.slice(0, MAX_REGISTER_PAGES) : [files[0]];
}

export function RegistersTab({ canManage }: { canManage: boolean }) {
  const [schoolId, setSchoolId] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [draft, setDraft] = useState<UploadDetail | null>(null);

  // Only the manage-only controls below use this list, so don't fetch (and don't
  // surface a permission error) for a view-only user who can't act on it anyway.
  const { data: schools, isError: schoolsFailed, isLoading: schoolsLoading, refetch: reloadSchools } = useQuery({
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

  const fileInput = useRef<HTMLInputElement | null>(null);

  const doUpload = () => {
    if (!schoolId || images.length === 0) {
      toast.error("Pick a school and a file first.");
      return;
    }
    upload.mutate(
      { school_id: schoolId, images },
      {
        onSuccess: (detail) => {
          toast.success("Uploaded — review the extracted grid");
          setImages([]);
          // The input keeps its own value; without this the cleared selection
          // still reads as "register.jpg" and re-uploading looks like a no-op.
          if (fileInput.current) fileInput.current.value = "";
          setDraft(detail);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  if (!canManage) {
    return (
      <p className="text-sm text-slate-500">
        You can view attendance in the Records tab. Uploading a register needs the
        attendance manage permission.
      </p>
    );
  }

  const needsSchool = !schoolId;

  return (
    <div className="space-y-4">
      {/* The school is the working context for EVERYTHING below — printing and
          uploading both act on it, so it lives above the sections, not inside one. */}
      <div className={styles.panel}>
        <label className="block text-sm font-semibold text-[var(--color-text)]">
          School
        </label>
        {schoolsFailed ? (
          <p className="mt-2 text-sm text-red-600">
            Could not load schools. <button type="button" onClick={() => void reloadSchools()} className="min-h-11 px-2 underline">Retry</button>
          </p>
        ) : (
          <div className="mt-1.5">
            <SchoolSearchPicker
              schools={schools ?? []}
              value={schoolId}
              onChange={setSchoolId}
              disabled={schoolsLoading}
              inputStyle={{ minHeight: 44 }}
              placeholder={schoolsLoading ? "Loading schools…" : `Search school by name, code or ${ZONE_LOWER}…`}
            />
          </div>
        )}
      </div>

      <div className={styles.registerActions}>
        <section className={styles.panel}>
          <h3
            className="font-semibold text-[var(--dark-teal)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Print register
          </h3>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs text-slate-500">
              Download a sheet with your school’s students, ready to print and mark by hand.
            </p>
            <Link
              href={schoolId ? `/print/register?school_id=${encodeURIComponent(schoolId)}` : "#"}
              target="_blank"
              rel="noopener"
              className={styles.secondary}
              aria-disabled={needsSchool}
              tabIndex={needsSchool ? -1 : undefined}
              onClick={(event) => { if (needsSchool) event.preventDefault(); }}
            >
              Print / download ↗
            </Link>
          </div>
        </section>

        <section className={styles.panel}>
          <h3
            className="font-semibold text-[var(--dark-teal)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Upload register
          </h3>
          <div className="mt-4 flex flex-col items-start gap-3">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,application/pdf,.pdf,.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setImages(pickFiles(e.target.files))}
              className={styles.uploadInput}
              aria-label="Register file"
              disabled={needsSchool || upload.isPending}
            />
            <button disabled={needsSchool || images.length === 0 || upload.isPending} onClick={doUpload} className={PRIMARY_BTN}>
              {upload.isPending ? "Extracting…" : "Upload & extract"}
            </button>
          </div>
          {images.length > 1 && (
            <p className="mt-2 text-xs text-slate-500">
              {images.length} pages selected, in this order:{" "}
              {images.map((f) => f.name).join(" → ")}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
            Up to {MAX_REGISTER_PAGES} photos, or one PDF, CSV or Excel file. Maximum 25 MB per file.
            Review and correct the extracted attendance before saving.
          </p>
          <details className="mt-2 text-xs text-[var(--color-text-muted)]">
            <summary className="min-h-11 cursor-pointer py-3">File requirements</summary>
            <p className="leading-relaxed">Photos can be JPEG, PNG, WebP or HEIC. Select register pages in order. Photos and PDFs should show the printed sheet clearly; spreadsheets need full dates in column headers.</p>
          </details>
        </section>
      </div>
      {needsSchool && <p className="text-sm text-[var(--color-text-muted)]">Choose a school to print or upload its register.</p>}

      {draft ? (
        <ReviewGrid
          upload={draft}
          onChange={setDraft}
          onDone={() => setDraft(null)}
        />
      ) : null}
    </div>
  );
}
