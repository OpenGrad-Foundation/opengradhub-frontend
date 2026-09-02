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
  type BulkParseJobStatus,
  type ParsedBulkQuiz,
  type ParseDiagnostic,
  type QuizDestination,
} from "@/lib/api";
import { QuizPreviewEditor } from "@/components/quiz-preview-editor";
import { QuizSourceEditor } from "@/components/quiz-source-editor";
import { hasStructuralIssue } from "@/lib/quiz-import-diagnostics";
import { withFrom } from "@/lib/nav";

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
    minHeight: "100vh",
    background: "#f0f2f5",
    fontFamily: "'Inter', sans-serif",
    color: "#034852",
  } as React.CSSProperties,
  pageInner: {
    maxWidth: "880px",
    margin: "0 auto",
    padding: "clamp(16px, 4vw, 32px) clamp(16px, 4vw, 20px) 80px",
  } as React.CSSProperties,
  glassCard: {
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "20px",
    padding: "clamp(16px, 5vw, 28px) clamp(16px, 5vw, 32px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-heading)",
    fontSize: "26px",
    fontWeight: 800,
    color: "#034852",
    margin: "0 0 8px 0",
  } as React.CSSProperties,
  banner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    marginBottom: "20px",
    borderRadius: "10px",
    background: "rgba(32,147,121,0.08)",
    border: "1px solid rgba(32,147,121,0.2)",
    color: "#0f6b58",
    fontSize: "13px",
    fontWeight: 600,
  } as React.CSSProperties,
  primaryBtn: {
    padding: "12px 28px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#fff",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
    transition: "all 0.2s",
  } as React.CSSProperties,
};

export default function BulkImportQuizPage() {
  const router = useRouter();
  const params = useSearchParams();

  // Where the quiz will be saved. Held in page state, never inside previewData:
  // that payload is round-tripped through an editable preview, so a destination
  // carried alongside its content would be editable too.
  const moduleId = params.get("module_id");
  const courseIdParam = params.get("course_id");
  const destination: QuizDestination = moduleId
    ? { kind: "MODULE", moduleId }
    : { kind: "GLOBAL" };

  // course_id is a redirect hint only. It is confirmed against the module's
  // real course before it is used as a redirect target; an unverified value
  // would let a crafted link bounce the author into an unrelated course.
  const [moduleTitle, setModuleTitle] = useState<string | null>(null);
  const [verifiedCourseId, setVerifiedCourseId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
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

      // The finished job reports the quiz it wrote, so land the author in the
      // builder for it — the next thing they want after an import. `from`
      // points Back at where the quiz lives.
      const quizId = (done.result as { quiz_id?: string } | undefined)?.quiz_id;
      const listHref = verifiedCourseId
        ? `/dashboard/course-management/${verifiedCourseId}?tab=curriculum`
        : `/dashboard/test-bank?uploadJobId=${result.jobId}`;
      router.push(
        quizId
          ? withFrom(
              `/dashboard/quiz-builder/${quizId}${verifiedCourseId ? `?course_id=${verifiedCourseId}` : ""}`,
              listHref,
            )
          : listHref,
      );
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

  return (
    <div style={S.pageOuter}>
      <div style={S.pageInner}>
        <div style={S.glassCard}>
          <div style={S.banner} role="status">
            <span aria-hidden>{destination.kind === "MODULE" ? "📘" : "🌐"}</span>
            <span>
              Saving to:{" "}
              <strong>
                {destination.kind === "GLOBAL"
                  ? "Global Test Bank"
                  : moduleTitle
                    ? `Module “${moduleTitle}”`
                    : "Course module"}
              </strong>
            </span>
          </div>

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
              <h1 style={S.heading}>Upload Entire Quiz</h1>
              {/* The destination banner above (S.banner) states this on every step,
                  so the module-only notice that used to sit here was duplicate. */}
              <p style={{ color: "rgba(3,72,82,0.6)", fontSize: "15px", marginBottom: "12px" }}>
                Upload a markdown (.md, .txt) or PDF file following the OpenGrad Quiz format.
                After uploading you can review and edit the parsed data before saving.
                PDFs must be typed (not scanned).
              </p>

              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
                <a
                  href="/templates/opengrad-quiz-template.md"
                  download="opengrad-quiz-template.md"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    padding: "9px 18px", borderRadius: "10px", textDecoration: "none",
                    background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)",
                    color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "12px",
                  }}
                >
                  ↓ Download template (.md)
                </a>
              </div>

              <details style={{ marginBottom: "20px", fontSize: "13px", color: "#034852" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: "13px", color: "#0f6b58" }}>
                  Format cheat-sheet
                </summary>
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

              <form
                onSubmit={(e) => { void handleParse(e); }}
                style={{ display: "flex", flexDirection: "column", gap: "20px" }}
              >
                <div>
                  <input
                    type="file"
                    accept=".md,.txt,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px",
                      border: "1.5px dashed rgba(3,72,82,0.2)",
                      borderRadius: "12px",
                      background: "rgba(3,72,82,0.02)",
                      color: "#034852",
                      cursor: "pointer",
                    }}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      background: "rgba(229,62,62,0.1)",
                      color: "#c53030",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    {error}
                  </div>
                )}

                {parsing && processingStatus && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px",
                      borderRadius: "8px",
                      background: "rgba(10,190,98,0.08)",
                      color: "#006d6c",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(0,109,108,0.25)",
                        borderTopColor: "#006d6c",
                        borderRadius: "50%",
                        animation: "og-spin 0.8s linear infinite",
                      }}
                    />
                    {processingStatus}
                    <style>{`@keyframes og-spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    style={{
                      ...S.primaryBtn,
                      background: "transparent",
                      border: "1.5px solid rgba(3,72,82,0.15)",
                      color: "#034852",
                      boxShadow: "none",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!file || parsing}
                    style={{ ...S.primaryBtn, opacity: !file || parsing ? 0.6 : 1 }}
                  >
                    {parsing ? "Parsing…" : "Parse File →"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            // ── Step 2: Preview & Edit ──────────────────────────────────────
            <>
              <h1 style={{ ...S.heading, margin: "0 0 24px 0" }}>Review Parsed Quiz</h1>
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
