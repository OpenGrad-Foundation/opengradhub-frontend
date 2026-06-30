"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkParseQuiz,
  bulkParseQuizFromPdf,
  bulkSaveQuiz,
  type ParsedBulkQuiz,
} from "@/lib/api";
import { QuizPreviewEditor } from "@/components/quiz-preview-editor";

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
    padding: "32px 20px 80px",
  } as React.CSSProperties,
  glassCard: {
    background: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "20px",
    padding: "28px 32px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-heading)",
    fontSize: "26px",
    fontWeight: 800,
    color: "#034852",
    margin: "0 0 8px 0",
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
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ParsedBulkQuiz | null>(null);

  // ── Step 1: parse the file ────────────────────────────────────────────────

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const parsed =
        file.type === "application/pdf"
          ? await bulkParseQuizFromPdf(file)
          : await bulkParseQuiz(await file.text());
      setPreviewData(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }

  // ── Step 2: save the (possibly edited) parsed data ────────────────────────

  async function handleSave() {
    if (!previewData) return;

    setSaving(true);
    setError(null);

    try {
      const result = await bulkSaveQuiz(previewData);
      router.push(`/dashboard/quiz-builder/${result.quiz_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save quiz");
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.pageOuter}>
      <div style={S.pageInner}>
        <div style={S.glassCard}>
          {previewData === null ? (
            // ── Step 1: Upload ──────────────────────────────────────────────
            <>
              <h1 style={S.heading}>Bulk Import Quiz</h1>
              <p style={{ color: "rgba(3,72,82,0.6)", fontSize: "15px", marginBottom: "24px" }}>
                Upload a markdown (.md, .txt) or PDF file following the OpenGrad Quiz format.
                After uploading you can review and edit the parsed data before saving.
                PDFs must be typed (not scanned).
              </p>

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
                data={previewData}
                onChange={setPreviewData}
                onConfirm={() => { void handleSave(); }}
                onBack={() => {
                  setPreviewData(null);
                  setError(null);
                }}
                saving={saving}
                error={error}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
