"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { bulkUploadQuestions, getQuestionTemplateUrl, type BulkQuestionResult } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";

const HEADERS = [
  "question_type", "question_text",
  "option_1", "option_2", "option_3", "option_4", "option_5", "option_6",
  "correct_options", "correct_answer", "tolerance",
  "programme_type", "subject", "topic", "difficulty", "explanation_video_url",
] as const;

const BULK_TYPES = ["MCQ", "FILL", "NUMERICAL"];
const OPTION_COLS = ["option_1", "option_2", "option_3", "option_4", "option_5", "option_6"] as const;

/** Mirrors backend question-csv.ts parseQuestionRows rules. Returns [] when valid. */
function rowErrors(r: Record<string, string>): string[] {
  const type = (r.question_type ?? "").trim().toUpperCase();
  if (type === "GROUP") return ["GROUP not supported"];
  if (!BULK_TYPES.includes(type)) return ["Bad type"];
  const errs: string[] = [];
  if (!(r.question_text ?? "").trim()) errs.push("Question text required");
  const options = OPTION_COLS.map((c) => (r[c] ?? "").trim());
  const filled = options.filter(Boolean);
  const correctRaw = (r.correct_options ?? "").trim();
  const answer = (r.correct_answer ?? "").trim();
  const tol = (r.tolerance ?? "").trim();
  if (type !== "MCQ" && filled.length > 0) errs.push("Options must be empty");
  if (type !== "MCQ" && correctRaw) errs.push("correct_options must be empty");
  if (type === "MCQ" && answer) errs.push("correct_answer must be empty");
  if (type !== "NUMERICAL" && tol) errs.push("tolerance not allowed");
  if (type === "MCQ") {
    if (filled.length < 2) errs.push("Need ≥2 options");
    const idx = correctRaw.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
    if (!correctRaw || idx.length === 0 || idx.some((n) => !Number.isInteger(n) || n < 1 || n > 6)) {
      errs.push("Bad correct_options");
    } else if (new Set(idx).size !== idx.length) {
      errs.push("Duplicate correct_options");
    } else if (idx.some((n) => options[n - 1] === "")) {
      errs.push("correct_options hits empty option");
    }
  }
  if (type === "FILL" && !answer) errs.push("correct_answer required");
  if (type === "NUMERICAL") {
    if (!answer || Number.isNaN(Number(answer))) errs.push("Numeric answer required");
    if (tol && (Number.isNaN(Number(tol)) || Number(tol) < 0)) errs.push("Bad tolerance");
  }
  return errs;
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadErroredCsv(result: BulkQuestionResult) {
  const cols = [...HEADERS, "error"];
  const lines = [cols.join(",")];
  result.skippedRows.forEach((row, i) => {
    const reason = result.errors[i] ?? "see report";
    lines.push([...HEADERS.map((h) => csvEscape(row[h] ?? "")), csvEscape(reason)].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions_errored_rows.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function QuestionBulkUploadPanel({ createdBy, onClose, onDone }: {
  createdBy?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [result, setResult] = useState<BulkQuestionResult | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!file) { setRows([]); setParseError(null); return; }
    let cancelled = false;
    setRows([]); setParseError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          preview: 1000,
          skipEmptyLines: true,
          transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
        });
        if (parsed.errors?.length) { setParseError(parsed.errors[0].message || "Invalid CSV format."); return; }
        const data = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        // "content_html" is the legacy header name for question_text — keep old sheets working.
        setRows(data.map((r) => Object.fromEntries(
          HEADERS.map((h) => [h, (h === "question_text" ? r[h] || r.content_html : r[h]) ?? ""]),
        )));
      } catch {
        setParseError("Failed to parse CSV. Please use the downloaded template.");
      }
    };
    reader.onerror = () => { if (!cancelled) setParseError("Could not read the file."); };
    reader.readAsText(file);
    return () => { cancelled = true; };
  }, [file]);

  function deleteRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  const errsPerRow = rows.map(rowErrors);
  const readyRows = rows.filter((_, i) => errsPerRow[i].length === 0);
  const readyCount = readyRows.length;
  const errorCount = rows.length - readyCount;

  async function doUpload(toUpload: Array<Record<string, string>>) {
    if (!toUpload.length) return;
    setUploading(true);
    try {
      const csv = [
        HEADERS.join(","),
        ...toUpload.map((row) => HEADERS.map((h) => csvEscape(row[h] ?? "")).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const newFile = new File([blob], file?.name ?? "questions.csv", { type: "text/csv" });
      const res = await bulkUploadQuestions(newFile, createdBy);
      invalidate('quizzes');
      setResult(res);
      onDone();
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : "Upload failed."], skippedRows: [] });
    } finally {
      setUploading(false);
    }
  }

  const hasData = rows.length > 0;

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Bulk Upload Questions</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.6)", margin: "0 0 14px" }}>
        Supports MCQ, Fill-in-the-blank, and Numerical questions. Write questions as plain text —
        no HTML needed (HTML is still accepted for rich formatting). Uploaded questions land in the
        question bank — attach them to quizzes from the quiz builder.
      </p>

      <a href={getQuestionTemplateUrl()} download="opengrad_questions_template.csv"
        style={{ ...primaryButton, display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", fontSize: "12px", padding: "10px 20px", background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }}>
        ↓ Download Template CSV
      </a>

      <div style={{ marginTop: "20px" }}>
        <label style={formLabelStyle}>Upload CSV File</label>
        <input type="file" accept=".csv"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
          style={{ ...inputStyle, padding: "10px" }} />
      </div>

      {parseError && (
        <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(229,62,62,0.06)", border: "1px solid rgba(229,62,62,0.2)", fontSize: "12px", fontWeight: 600, color: "#c53030" }}>
          {parseError}
        </div>
      )}

      {hasData && (
        <div style={{ marginTop: "20px" }}>
          <p style={formLabelStyle}>Preview</p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "12px 16px", borderRadius: "12px", marginBottom: "12px", background: errorCount > 0 ? "rgba(229,62,62,0.05)" : "rgba(10,190,98,0.06)", border: `1px solid ${errorCount > 0 ? "rgba(229,62,62,0.2)" : "rgba(10,190,98,0.2)"}` }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0abe62" }}>✓ {readyCount} ready</span>
            {errorCount > 0 && <span style={{ fontSize: "13px", fontWeight: 700, color: "#e53e3e" }}>✗ {errorCount} with errors</span>}
            <div style={{ marginLeft: "auto" }}>
              <button onClick={() => void doUpload(readyRows)} disabled={uploading || readyCount === 0}
                style={{ ...primaryButton, padding: "8px 16px", fontSize: "12px", opacity: uploading || readyCount === 0 ? 0.5 : 1 }}>
                {uploading ? "Uploading…" : errorCount > 0 ? `Import Ready Rows (${readyCount})` : `Import All (${rows.length})`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.10)", background: "rgba(255,255,255,0.55)", maxHeight: "400px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "900px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: "rgba(3,72,82,0.07)", textAlign: "left" }}>
                  <th style={{ padding: "9px 10px", width: "32px" }} />
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Question</th>
                  <th style={thStyle}>Options</th>
                  <th style={thStyle}>Answer</th>
                  <th style={thStyle}>Tags</th>
                  <th style={{ ...thStyle, minWidth: "140px" }}>Errors</th>
                  <th style={{ padding: "9px 10px", width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const errs = errsPerRow[idx];
                  const hasErr = errs.length > 0;
                  const type = (row.question_type ?? "").toUpperCase();
                  const opts = OPTION_COLS.map((c) => row[c]).filter(Boolean);
                  const answer = type === "MCQ"
                    ? `✓ ${row.correct_options}`
                    : `${row.correct_answer}${row.tolerance ? ` ± ${row.tolerance}` : ""}`;
                  const tags = [row.programme_type, row.subject, row.topic, row.difficulty].filter(Boolean).join(" · ");
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(3,72,82,0.06)", background: hasErr ? "rgba(229,62,62,0.02)" : "transparent" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <span title={hasErr ? errs.join(", ") : "Row is valid"}>{hasErr ? "⚠️" : "✅"}</span>
                      </td>
                      <td style={tdStyle}>{type}</td>
                      <td style={{ ...tdStyle, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {(row.question_text ?? "").replace(/<[^>]+>/g, "")}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opts.join(" | ")}
                      </td>
                      <td style={tdStyle}>{answer}</td>
                      <td style={{ ...tdStyle, fontSize: "11px", color: "rgba(3,72,82,0.55)" }}>{tags}</td>
                      <td style={{ padding: "6px 10px", minWidth: "140px" }}>
                        {hasErr && <span style={{ fontSize: "11px", color: "#e53e3e", fontWeight: 600 }}>{errs.join(", ")}</span>}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <button onClick={() => deleteRow(idx)} title="Remove row"
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#c53030" }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.45)" }}>
            {rows.length} row{rows.length !== 1 ? "s" : ""} loaded. Fix errored rows in your sheet and re-upload, or 🗑 to drop them.
          </p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: "20px", padding: "16px", borderRadius: "12px", background: "rgba(3,72,82,0.04)" }}>
          <p style={{ fontWeight: 700, color: "#034852", fontSize: "15px" }}>
            ✅ {result.created} question{result.created !== 1 ? "s" : ""} created
            {result.skipped > 0 && <>, ⚠️ {result.skipped} skipped</>}
          </p>
          {result.errors.length > 0 && (
            <ul style={{ marginTop: "10px", paddingLeft: "20px", fontSize: "12px", color: "#e53e3e", lineHeight: 1.8 }}>
              {result.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
          {result.skippedRows.length > 0 && (
            <button onClick={() => downloadErroredCsv(result)} style={{ ...primaryButton, marginTop: "10px", padding: "8px 16px", fontSize: "12px", background: "linear-gradient(135deg, #e53e3e 0%, #c53030 100%)" }}>
              ↓ Download {result.skippedRows.length} errored row{result.skippedRows.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" };
const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "9px 10px", color: "rgba(3,72,82,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "10px", fontWeight: 700 };
const tdStyle: React.CSSProperties = { padding: "6px 10px", color: "#034852" };
