"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bulkParseCancel,
  bulkParseQuiz,
  bulkParseQuizFromPdf,
  bulkSaveQuiz,
  getBulkParseJobStatus,
  getCourseModules,
  getProgrammes,
  type BulkParseJobStatus,
  type Programme,
  type ParsedBulkQuiz,
  type ParseDiagnostic,
  type QuizDestination,
} from "@/lib/api";
import { QuizPreviewEditor } from "@/components/quiz-preview-editor";
import { QuizSourceEditor } from "@/components/quiz-source-editor";
import { hasStructuralIssue } from "@/lib/quiz-import-diagnostics";
import { getBackHref } from "@/lib/nav";
import { SearchableSelect } from "@/app/dashboard/analytics/_components/SearchableSelect";

// PDF parsing runs as a background job on the server; the page polls its
// status until completion instead of holding one long HTTP request open.
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jobStatusLabel(status: BulkParseJobStatus): string {
  switch (status.status) {
    case "waiting":
    case "delayed":
      return "Queued — waiting for a worker…";
    case "active":
      return status.progress >= 90
        ? "Finalizing…"
        : "Extracting text and images…";
    default:
      return "Processing…";
  }
}

const S = {
  pageOuter: {
    color: "var(--color-text)",
  } as React.CSSProperties,
  pageInner: {
    maxWidth: "880px",
    paddingBottom: "80px",
  } as React.CSSProperties,
  glassCard: {
    background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)",
  } as React.CSSProperties,
  heading: {
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--color-text)",
    margin: "0 0 8px 0",
  } as React.CSSProperties,
  primaryBtn: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer",
  } as React.CSSProperties,
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Hover, focus-within and drag states can't be inline styles, so the page
// carries its own small sheet. Prefixed qbi- to stay out of everyone's way.
const BULK_CSS = `
.qbi-steps { display: flex; gap: 8px; list-style: none; margin: 0 0 20px; padding: 0; font-size: 13px; font-weight: 600; color: var(--color-text-subtle); flex-wrap: wrap; }
.qbi-steps li { display: flex; align-items: center; gap: 8px; }
.qbi-steps li + li::before { content: ""; width: 28px; height: 1px; background: var(--color-border-strong); margin-right: 4px; }
.qbi-steps li[aria-current="step"] { color: var(--dark-teal); }
.qbi-step-dot { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font-size: 12px; border: 1px solid var(--color-border-strong); background: var(--color-surface); }
.qbi-steps li[aria-current="step"] .qbi-step-dot { background: var(--green); border-color: var(--green); color: var(--dark-teal); }
.qbi-steps li[data-done="true"] .qbi-step-dot { background: var(--color-success-surface); border-color: transparent; color: var(--teal); }

.qbi-dest { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 24px; padding: 14px 16px; margin-bottom: 24px; border-radius: 14px; background: color-mix(in srgb, var(--teal) 5%, transparent); border: 1px solid var(--color-border); }
.qbi-dest-where { display: grid; gap: 4px; flex: 1 1 200px; }
.qbi-dest-pick { display: grid; gap: 6px; flex: 1 1 260px; }
.qbi-dest-name { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: var(--dark-teal); min-height: 36px; }
.qbi-dest-note { flex-basis: 100%; margin: 0; font-size: 12px; color: var(--color-text-subtle); }
.qbi-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-subtle); }

.qbi-sub { margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: var(--color-text-muted); }
.qbi-form { display: flex; flex-direction: column; gap: 16px; }

.qbi-drop { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 176px; padding: 28px 20px; text-align: center; cursor: pointer; border: 1.5px dashed var(--color-border-strong); border-radius: 16px; background: color-mix(in srgb, var(--teal) 3%, transparent); color: var(--dark-teal); transition: border-color 0.15s ease, background-color 0.15s ease; }
.qbi-drop:hover, .qbi-drop[data-active="true"] { border-color: var(--light-teal); background: color-mix(in srgb, var(--green) 7%, transparent); }
.qbi-drop[data-has-file="true"] { border-style: solid; border-color: var(--light-teal); min-height: 0; padding: 16px; }
.qbi-drop:focus-within { outline: 2px solid var(--teal); outline-offset: 2px; }
.qbi-file { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
.qbi-drop-icon { color: var(--light-teal); margin-bottom: 4px; }
.qbi-drop-title { font-size: 15px; font-weight: 600; }
.qbi-drop-title u { text-underline-offset: 3px; color: var(--teal); }
.qbi-drop-hint { font-size: 12px; color: var(--color-text-subtle); }

.qbi-filecard { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; }
.qbi-filebadge { display: grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: 10px; background: var(--dark-teal); color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; }
.qbi-filemeta { display: grid; gap: 2px; min-width: 0; flex: 1; }
.qbi-filemeta strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qbi-filemeta span { font-size: 12px; color: var(--color-text-subtle); }
.qbi-remove { flex: none; width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--dark-teal); cursor: pointer; }
.qbi-remove:hover { border-color: var(--color-danger); color: var(--color-danger); }

.qbi-help { border: 1px solid var(--color-border); border-radius: 14px; overflow: hidden; }
.qbi-help-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px; font-size: 13px; color: var(--color-text-muted); }
.qbi-template { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; text-decoration: none; font-size: 12px; font-weight: 700; color: var(--teal); border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent); background: var(--color-surface); }
.qbi-template:hover { background: color-mix(in srgb, var(--teal) 8%, transparent); }
.qbi-cheat { border-top: 1px solid var(--color-border); padding: 12px 16px; font-size: 13px; color: var(--dark-teal); }
.qbi-cheat summary { cursor: pointer; font-weight: 700; color: var(--teal); }

.qbi-alert { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; }
.qbi-alert[data-tone="error"] { background: var(--color-danger-surface); color: #c53030; }
.qbi-alert[data-tone="info"] { background: var(--color-success-surface); color: var(--teal); }
.qbi-spinner { width: 14px; height: 14px; flex: none; border: 2px solid color-mix(in srgb, var(--teal) 25%, transparent); border-top-color: var(--teal); border-radius: 50%; animation: qbi-spin 0.8s linear infinite; }
@keyframes qbi-spin { to { transform: rotate(360deg); } }

.qbi-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; padding-top: 16px; border-top: 1px solid var(--color-border); }
.qbi-actions-hint { margin-right: auto; font-size: 12px; color: var(--color-text-subtle); }

@media (prefers-reduced-motion: reduce) { .qbi-drop { transition: none; } .qbi-spinner { animation-duration: 2.4s; } }
`;

export default function BulkImportQuizPage() {
  const router = useRouter();
  const params = useSearchParams();

  // Where the quiz will be saved. Held in page state, never inside previewData:
  // that payload is round-tripped through an editable preview, so a destination
  // carried alongside its content would be editable too.
  const moduleId = params.get("module_id");
  const courseIdParam = params.get("course_id");
  // Where the author came from. Validated by getBackHref before it is used, so
  // a crafted link cannot bounce them off-site after a save.
  const fromParam = params.get("from");

  // A standalone quiz belongs to one programme. The server infers it when the
  // author belongs to exactly one; with several it refuses the save unless one
  // is named, so the author picks here. Module quizzes take their course's.
  // Only member programmes are offered: GET /programmes returns everything in
  // reach, and creating into a programme you merely reach is refused.
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [programmeId, setProgrammeId] = useState("");
  const [programmesLoaded, setProgrammesLoaded] = useState(false);
  useEffect(() => {
    if (moduleId) return;
    let stale = false;
    void getProgrammes()
      .then((list) => {
        if (stale) return;
        const mine = list.filter((p) => p.is_member !== false);
        setProgrammes(mine);
        if (mine.length === 1) setProgrammeId(mine[0].id);
      })
      // The server still decides; a failed list must not block the import.
      .catch(() => undefined)
      .finally(() => { if (!stale) setProgrammesLoaded(true); });
    return () => { stale = true; };
  }, [moduleId]);
  const needsProgramme = !moduleId && programmes.length > 1 && !programmeId;

  const destination: QuizDestination = moduleId
    ? { kind: "MODULE", moduleId }
    : programmeId ? { kind: "GLOBAL", programmeId } : { kind: "GLOBAL" };

  // course_id is a redirect hint only. It is confirmed against the module's
  // real course before it is used as a redirect target; an unverified value
  // would let a crafted link bounce the author into an unrelated course.
  const [moduleTitle, setModuleTitle] = useState<string | null>(null);
  const [verifiedCourseId, setVerifiedCourseId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ParsedBulkQuiz | null>(null);
  // The editable SOURCE: the uploaded text for .md/.txt, the extracted text
  // for a PDF. Structural problems (a lost Q.n / [SECTION] / [GROUP END]) are
  // fixed here and reparsed — the structured preview cannot split questions.
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  // Bumped per successful parse: remounts the preview editor so its
  // diagnostics buckets re-seed from the fresh parse result.
  const [parseSeq, setParseSeq] = useState(0);
  // Storage keys of images uploaded during a PDF parse. Kept outside
  // previewData so edits to the preview can't lose track of them; sent to the
  // cleanup endpoint if the preview is abandoned.
  const [imageKeys, setImageKeys] = useState<string[]>([]);

  // Stops the polling loop if the user navigates away mid-parse.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => { cancelledRef.current = true; };
  }, []);

  useEffect(() => {
    if (!moduleId || !courseIdParam) return;
    let stale = false;
    // Failures leave the banner generic and the redirect on its global
    // fallback — the destination itself is authorized server-side regardless.
    void getCourseModules(courseIdParam)
      .then((modules) => {
        const found = modules.find((m) => m.id === moduleId);
        if (stale || !found) return;
        setModuleTitle(found.title);
        setVerifiedCourseId(courseIdParam);
      })
      .catch(() => undefined);
    return () => { stale = true; };
  }, [moduleId, courseIdParam]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // (The module-title lookup lives above, in the effect that also verifies
  // course_id before it is trusted as a redirect target.)

  // ── Step 1: parse the file ────────────────────────────────────────────────

  /**
   * Polls a background job until it settles. Resolves with the completed job,
   * or null if the page was unmounted mid-poll; throws on job failure, poll
   * timeout, or repeated poll errors. `label` names the job in those errors.
   */
  async function pollJobUntilDone(
    jobId: string,
    label: string,
    onProgress: (status: BulkParseJobStatus) => void,
  ): Promise<BulkParseJobStatus | null> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let consecutivePollErrors = 0;

    for (;;) {
      if (cancelledRef.current) return null;
      if (Date.now() > deadline) {
        throw new Error(`${label} timed out. Please try again.`);
      }
      await sleep(POLL_INTERVAL_MS);
      if (cancelledRef.current) return null;

      let status: BulkParseJobStatus;
      try {
        status = await getBulkParseJobStatus(jobId);
        consecutivePollErrors = 0;
      } catch (err: unknown) {
        // Tolerate a couple of transient network blips before giving up.
        consecutivePollErrors += 1;
        if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw err;
        continue;
      }

      if (status.status === "completed") return status;
      if (status.status === "failed") {
        throw new Error(status.error || `${label} failed.`);
      }
      onProgress(status);
    }
  }

  /**
   * PDFs are parsed by a background worker: enqueue the job, then poll its
   * status until it completes (or fails / times out).
   */
  async function parsePdfInBackground(pdfFile: File): Promise<void> {
    setProcessingStatus("Uploading and queuing…");
    const { jobId } = await bulkParseQuizFromPdf(pdfFile);

    const done = await pollJobUntilDone(jobId, "PDF processing", (status) =>
      setProcessingStatus(jobStatusLabel(status)),
    );
    if (!done) return;

    const { image_keys, source_text, source_truncated: _st, parse_error, ...parsed } =
      (done.result ?? {}) as ParsedBulkQuiz & {
        image_keys?: string[]; source_text?: string; source_truncated?: boolean;
        parse_error?: string;
      };
    setImageKeys(image_keys ?? []);
    setSourceText(source_text ?? null);

    if (parse_error) {
      // Extraction worked, parsing didn't — a repairable state, not a dead
      // end: land in the source step with the extracted text and the error.
      // (Text beyond the transfer cap can't be edited here — say so instead
      // of failing silently back to the upload form.)
      setPreviewData(null);
      setShowSource(source_text != null);
      setError(
        source_text != null
          ? parse_error
          : `${parse_error} The extracted text was too large to edit in the browser — fix the original document and upload again.`,
      );
      return;
    }

    setPreviewData(parsed as ParsedBulkQuiz);
    setParseSeq((n) => n + 1);
    // Structural problems can only be fixed in the source — land there first.
    setShowSource(source_text != null && hasStructuralIssue(parsed.diagnostics ?? []));
    setToast("PDF parsed successfully!");
  }

  // From the picker or a drop. A drop skips the input's accept filter, so the
  // extension is checked here; null clears the choice.
  function pickFile(next: File | null) {
    if (next && !/\.(md|txt|pdf)$/i.test(next.name)) {
      setError("Use a .md, .txt or .pdf file.");
      return;
    }
    setFile(next);
    setError(null);
    if (!next && fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      if (file.type === "application/pdf") {
        await parsePdfInBackground(file);
      } else {
        const text = await file.text();
        setSourceText(text);
        setImageKeys([]);
        try {
          const parsed = await bulkParseQuiz(text);
          setPreviewData(parsed);
          setParseSeq((n) => n + 1);
          setShowSource(hasStructuralIssue(parsed.diagnostics ?? []));
        } catch (parseErr: unknown) {
          // A hard parse failure (e.g. an unterminated [START]) used to be a
          // dead end; the source step turns it into something fixable.
          setShowSource(true);
          throw parseErr;
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
      setProcessingStatus(null);
    }
  }

  /** Reparse edited source (both .md text and PDF-extracted text). */
  async function handleReparse(nextSource: string) {
    setParsing(true);
    setError(null);
    try {
      const parsed = await bulkParseQuiz(nextSource);
      setSourceText(nextSource);
      setPreviewData(parsed);
      setParseSeq((n) => n + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse the edited source");
    } finally {
      setParsing(false);
    }
  }

  function handleEditSource() {
    if (sourceText == null) return;
    if (!window.confirm(
      "Edit the source? Changes made in this preview will be discarded when you reparse — the source becomes the truth again.",
    )) return;
    setShowSource(true);
  }

  // ── Step 2: save the (possibly edited) parsed data ────────────────────────

  async function handleSave(unresolved: ParseDiagnostic[]) {
    if (!previewData) return;
    if (needsProgramme) {
      setError("Choose which programme this quiz belongs to.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await bulkSaveQuiz(previewData, destination, unresolved);
      // The saved quiz now references the images — they must not be cleaned up.
      setImageKeys([]);
      setToast("Saving quiz in the background…");
      // Wait for the job to finish rather than a fixed delay: a large import
      // outlives any guess, and the destination page would then render before
      // the quiz rows exist, leaving it invisible until a manual refresh.
      const done = await pollJobUntilDone(result.jobId, "Quiz saving", () => undefined);
      if (!done) return;

      // Return the author to where they started — the module's curriculum or
      // the quiz bank — rather than dropping them into the new quiz's builder.
      // The import is finished at this point; the list is where they can see
      // it alongside everything else, and it is the page they left.
      const listHref = verifiedCourseId
        ? `/dashboard/course-management/${verifiedCourseId}?tab=curriculum`
        : `/dashboard/test-bank?uploadJobId=${result.jobId}`;
      router.push(getBackHref(fromParam, listHref));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to queue quiz for saving");
      setSaving(false);
    }
  }

  // ── Abandoning the preview: clean up images uploaded during the parse ─────

  function handleDiscardPreview() {
    if (imageKeys.length > 0) {
      // Best-effort: failures are logged server-side, and any leftover
      // objects are reclaimed by the orphaned-image garbage collector.
      void bulkParseCancel(imageKeys).catch(() => undefined);
      setImageKeys([]);
    }
    setPreviewData(null);
    setSourceText(null);
    setShowSource(false);
    setError(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const step = previewData === null && !showSource ? 1 : 2;
  const showProgrammePicker = !moduleId && (!programmesLoaded || programmes.length > 0);

  return (
    <div style={S.pageOuter}>
      <style>{BULK_CSS}</style>
      <div style={S.pageInner}>
        <div style={S.glassCard}>
          <ol className="qbi-steps" aria-label="Import steps">
            {["Upload file", "Review & save"].map((label, i) => (
              <li key={label} aria-current={step === i + 1 ? "step" : undefined} data-done={step > i + 1}>
                <span className="qbi-step-dot" aria-hidden>{step > i + 1 ? "✓" : i + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          <section className="qbi-dest" aria-label="Destination">
            <div className="qbi-dest-where" role="status">
              <span className="qbi-eyebrow">Saving to</span>
              <span className="qbi-dest-name">
                <span aria-hidden>{destination.kind === "MODULE" ? "📘" : "🌐"}</span>
                {destination.kind === "GLOBAL"
                  ? "Global Test Bank"
                  : moduleTitle
                    ? `Module “${moduleTitle}”`
                    : "Course module"}
              </span>
            </div>

            {/* Drawn on every step, not just upload: the list can arrive after
                the author has already parsed, and save is refused without it.
                Shown while loading (disabled) and for a single programme too, so
                it holds its place instead of popping in when the list arrives. */}
            {showProgrammePicker && (
              <div className="qbi-dest-pick">
                <span className="qbi-eyebrow">Programme *</span>
                <SearchableSelect
                  ariaLabel="Programme"
                  value={programmeId}
                  onChange={(v) => { setProgrammeId(v); setError(null); }}
                  options={programmes.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder={programmesLoaded ? "Select a programme…" : "Loading programmes…"}
                  disabled={!programmesLoaded}
                />
              </div>
            )}
            {showProgrammePicker && (
              <p className="qbi-dest-note">
                Only this programme will see and use the quiz. Others can duplicate it into their own.
              </p>
            )}
          </section>

          {showSource && sourceText != null ? (
            // ── Step 1.5: Repair the source (full-screen workbench) ─────────
            <QuizSourceEditor
              source={sourceText}
              quiz={previewData}
              diagnostics={previewData?.diagnostics ?? []}
              parsing={parsing}
              error={error}
              onReparse={(next) => { void handleReparse(next); }}
              onContinue={() => { if (previewData) setShowSource(false); }}
              onCancel={handleDiscardPreview}
            />
          ) : previewData === null ? (
            // ── Step 1: Upload ──────────────────────────────────────────────
            <>
              <h2 style={S.heading}>Upload a quiz file</h2>
              {/* The destination section above states where it saves on every step,
                  so the module-only notice that used to sit here was duplicate. */}
              <p className="qbi-sub">
                Markdown (.md, .txt) or a typed PDF in the OpenGrad quiz format.
                You review and edit every question before anything is saved.
              </p>

              <form onSubmit={(e) => { void handleParse(e); }} className="qbi-form">
                <label
                  className="qbi-drop"
                  data-active={dragOver}
                  data-has-file={!!file}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt,.pdf"
                    className="qbi-file"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <span className="qbi-filecard">
                      <span className="qbi-filebadge" aria-hidden>{(file.name.split(".").pop() ?? "").toUpperCase()}</span>
                      <span className="qbi-filemeta">
                        <strong>{file.name}</strong>
                        <span>{formatSize(file.size)} · click or drop to replace</span>
                      </span>
                      <button
                        type="button"
                        className="qbi-remove"
                        aria-label="Remove file"
                        onClick={(e) => { e.preventDefault(); pickFile(null); }}
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <>
                      <svg className="qbi-drop-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" />
                        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                      </svg>
                      <span className="qbi-drop-title">Drop your quiz file here, or <u>browse</u></span>
                      <span className="qbi-drop-hint">.md · .txt · .pdf (typed, not scanned)</span>
                    </>
                  )}
                </label>

                <div className="qbi-help">
                  <div className="qbi-help-row">
                    <span>New to the format? Start from the template.</span>
                    <a className="qbi-template" href="/templates/opengrad-quiz-template.md" download="opengrad-quiz-template.md">
                      ↓ Download template (.md)
                    </a>
                  </div>
                  <details className="qbi-cheat">
                    <summary>Format cheat-sheet</summary>
                    <div style={{ overflowX: "auto", marginTop: "10px" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: "12px", minWidth: "540px" }}>
                    <tbody>
                      {([
                        ["[TEST TITLE] / [TEST INSTRUCTION] / [TEST DURATION] / [TEST MAXIMUM MARKS]", "Quiz header (title is required)"],
                        ["[SECTION] name · [SECTION DURATION] · [SECTION MARKS]", "Starts a section"],
                        ["Q.1) question text", "Starts a question (numbering restarts per section)"],
                        ["*[A] correct · [B] wrong — or *[1] / [2]", "MCQ options; * marks the correct one"],
                        ["[QUESTION TYPE] Multi_Choice / Numerical / Fill / Essay", "Defaults to MCQ"],
                        ["[A] 9.8  or  [A] 9.7_9.9", "Answer for Numerical/Fill (range = value with tolerance)"],
                        ["[MARKS] · [NEGATIVE MARKS] · [ANSWER TIME]", "Per-question numbers"],
                        ["[SUBJECT] · [TOPIC] · [DIFFICULTY] EASY/MEDIUM/HARD · [TAG]", "Tags — used by analytics, filters and report cards"],
                        ["[SOLUTION] · [IMAGE] url", "Explanation shown after submission; inline image"],
                        ["[START] … [END]", "Wraps any multi-line block, keeping its line breaks"],
                        ["[GROUP START] … [GROUP END]", "A passage with child questions"],
                        ["i.1-3) shared instruction", "Stamps an instruction on the next 3 questions"],
                      ] as const).map(([syntax, meaning]) => (
                        <tr key={syntax} style={{ borderBottom: "1px solid rgba(3,72,82,0.08)" }}>
                          <td style={{ padding: "6px 12px 6px 0", whiteSpace: "nowrap" }}><code>{syntax}</code></td>
                          <td style={{ padding: "6px 0", color: "rgba(3,72,82,0.65)" }}>{meaning}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                    </div>
                  </details>
                </div>

                {error && <div className="qbi-alert" data-tone="error" role="alert">{error}</div>}

                {parsing && processingStatus && (
                  <div className="qbi-alert" data-tone="info" role="status">
                    <span className="qbi-spinner" aria-hidden />
                    {processingStatus}
                  </div>
                )}

                <div className="qbi-actions">
                  <span className="qbi-actions-hint">
                    {needsProgramme ? "Choose a programme first." : "Next: review the parsed questions."}
                  </span>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    style={{ ...S.primaryBtn, background: "transparent", border: "1.5px solid rgba(3,72,82,0.15)", color: "#034852" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!file || parsing || needsProgramme}
                    style={{ ...S.primaryBtn, opacity: !file || parsing || needsProgramme ? 0.6 : 1, cursor: !file || parsing || needsProgramme ? "not-allowed" : "pointer" }}
                  >
                    {parsing ? "Parsing…" : "Parse File →"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            // ── Step 2: Preview & Edit ──────────────────────────────────────
            <>
              <h2 style={{ ...S.heading, margin: "0 0 24px 0" }}>Review parsed quiz</h2>
              <QuizPreviewEditor
                // Remount per parse so the diagnostics buckets re-seed.
                key={parseSeq}
                data={previewData}
                onChange={setPreviewData}
                onConfirm={(unresolved) => { void handleSave(unresolved); }}
                onBack={handleDiscardPreview}
                initialDiagnostics={previewData.diagnostics}
                onEditSource={sourceText != null ? handleEditSource : undefined}
                saving={saving}
                error={error}
              />
            </>
          )}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 1000,
            padding: "14px 20px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
            color: "#fff",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            fontSize: "14px",
            boxShadow: "0 8px 24px rgba(0,109,108,0.35)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
