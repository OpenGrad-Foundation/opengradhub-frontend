"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";
import { bulkUploadSchools, getSchoolTemplateUrl } from "@/lib/api";
import { isKnownState, isValidDistrictForState, normState, ALL_STATE, STATES, resolveState, resolveDistrict } from "@/lib/geo";
import { useInvalidate } from "@/lib/mutations/invalidation";

const HEADERS = ["name", "district", "state", "code"] as const;
const HEADER_LABELS: Record<string, string> = {
  name: "Name", district: "District", state: "State", code: "Code",
};

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadErroredCsv(result: { skippedRows: Array<Record<string, string>>; errors: string[] }) {
  const cols = [...HEADERS, "error"];
  const lines = [cols.join(",")];
  for (const row of result.skippedRows) {
    const reason = result.errors.find((e) => row.name && e.includes(`"${row.name}"`)) ?? "see report";
    lines.push([...HEADERS.map((h) => csvEscape(row[h] ?? "")), csvEscape(reason)].join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schools_errored_rows.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SchoolBulkUploadPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[]; corrections: string[]; skippedRows: Array<Record<string, string>> } | null>(null);
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
          preview: 500,
          skipEmptyLines: true,
          transform: (v) => (typeof v === "string" ? v.trim() : String(v ?? "")),
        });
        if (parsed.errors?.length) { setParseError(parsed.errors[0].message || "Invalid CSV format."); return; }
        const data = (parsed.data ?? []).filter((r) => r && Object.keys(r).length > 0);
        setRows(data.map((r) => ({
          name: r.name ?? "", district: r.district ?? "", state: r.state ?? "", code: r.code ?? "",
        })));
      } catch {
        setParseError("Failed to parse CSV. Please use the downloaded template.");
      }
    };
    reader.onerror = () => { if (!cancelled) setParseError("Could not read the file."); };
    reader.readAsText(file);
    return () => { cancelled = true; };
  }, [file]);

  function updateCell(idx: number, col: string, value: string) {
    setRows((prev) => { const next = [...prev]; next[idx] = { ...next[idx], [col]: value }; return next; });
  }
  function deleteRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  // Per-row validation: name required; code duplicated within staged rows.
  const codeCounts = new Map<string, number>();
  for (const r of rows) {
    const c = (r.code ?? "").trim().toLowerCase();
    if (c) codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
  }
  function rowErrors(r: Record<string, string>): string[] {
    const errs: string[] = [];
    if (!r.name?.trim()) errs.push("Name");
    if (!r.state?.trim()) errs.push("State");
    else if (normState(r.state) !== ALL_STATE && !r.district?.trim()) errs.push("District");
    const c = (r.code ?? "").trim().toLowerCase();
    if (c && (codeCounts.get(c) ?? 0) > 1) errs.push("Duplicate code");
    return errs;
  }
  const errsPerRow = rows.map(rowErrors);
  // Non-blocking geo warnings: unknown state, or district not in that state.
  function rowWarnings(r: Record<string, string>): string[] {
    const warns: string[] = [];
    const st = (r.state ?? "").trim();
    const di = (r.district ?? "").trim();
    if (st && !isKnownState(st)) {
      warns.push("Unknown state");
    } else if (st && di && !isValidDistrictForState(st, di)) {
      const label = STATES.find((s) => s.value === normState(st))?.label ?? st;
      warns.push(`District not in ${label}`);
    }
    return warns;
  }
  const resolved = rows.map((r) => {
    const rs = resolveState(r.state ?? "");
    const state = rs.status === "exact" || rs.status === "corrected" ? rs.value : (r.state ?? "");
    const rd = resolveDistrict(state, r.district ?? "");
    const district = rd.status === "exact" || rd.status === "corrected" ? rd.value : (r.district ?? "");
    return { state, district, stateStatus: rs, districtStatus: rd };
  });
  const resolvedRows = rows.map((r, i) => ({ ...r, state: resolved[i].state, district: resolved[i].district }));
  const warnsPerRow = resolvedRows.map(rowWarnings);
  const warnCount = warnsPerRow.filter((w) => w.length > 0).length;
  const readyRows = rows.filter((_, i) => errsPerRow[i].length === 0);
  const readyCount = readyRows.length;
  const errorCount = rows.length - readyCount;
  const readyResolved = resolvedRows.filter((_, i) => errsPerRow[i].length === 0);

  async function doUpload(toUpload: Array<Record<string, string>>) {
    if (!toUpload.length) return;
    setUploading(true);
    try {
      const csv = [
        HEADERS.join(","),
        ...toUpload.map((row) => HEADERS.map((h) => csvEscape(row[h] ?? "")).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const newFile = new File([blob], file?.name ?? "schools.csv", { type: "text/csv" });
      const res = await bulkUploadSchools(newFile);
      invalidate('schools');
      setResult(res);
      onDone();
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : "Upload failed."], corrections: [], skippedRows: [] });
    } finally {
      setUploading(false);
    }
  }

  const hasData = rows.length > 0;

  return (
    <div style={{ ...glassCard, textAlign: "left", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <p style={labelStyle}>Bulk Upload Schools</p>
        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>

      <a href={getSchoolTemplateUrl()} download="opengrad_schools_template.csv"
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
          <p style={formLabelStyle}>Preview &amp; Edit</p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", padding: "12px 16px", borderRadius: "12px", marginBottom: "12px", background: errorCount > 0 ? "rgba(229,62,62,0.05)" : "rgba(10,190,98,0.06)", border: `1px solid ${errorCount > 0 ? "rgba(229,62,62,0.2)" : "rgba(10,190,98,0.2)"}` }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#0abe62" }}>✓ {readyCount} ready</span>
            {errorCount > 0 && <span style={{ fontSize: "13px", fontWeight: 700, color: "#e53e3e" }}>✗ {errorCount} with errors</span>}
            {warnCount > 0 && (
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#b7791f" }}>
                ⚠ {warnCount} to review
              </span>
            )}
            <div style={{ marginLeft: "auto" }}>
              <button onClick={() => void doUpload(errorCount > 0 ? readyResolved : resolvedRows)} disabled={uploading || readyCount === 0}
                style={{ ...primaryButton, padding: "8px 16px", fontSize: "12px", opacity: uploading || readyCount === 0 ? 0.5 : 1 }}>
                {uploading ? "Uploading…" : errorCount > 0 ? `Import Ready Rows (${readyCount})` : `Import All (${rows.length})`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.10)", background: "rgba(255,255,255,0.55)", maxHeight: "400px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "640px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
                <tr style={{ background: "rgba(3,72,82,0.07)", textAlign: "left" }}>
                  <th style={{ padding: "9px 10px", width: "32px" }} />
                  {HEADERS.map((h) => (
                    <th key={h} style={{ padding: "9px 10px", color: "rgba(3,72,82,0.7)", textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "10px", fontWeight: 700 }}>
                      {HEADER_LABELS[h]}
                    </th>
                  ))}
                  <th style={{ padding: "9px 10px", color: "rgba(3,72,82,0.5)", fontSize: "10px", minWidth: "120px" }}>ERRORS</th>
                  <th style={{ padding: "9px 10px", width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const errs = errsPerRow[idx];
                  const hasErr = errs.length > 0;
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(3,72,82,0.06)", background: hasErr ? "rgba(229,62,62,0.02)" : "transparent" }}>
                      <td style={{ padding: "6px 8px", textAlign: "center" }}>
                        <span title={hasErr ? errs.join(", ") : "Row is valid"}>{hasErr ? "⚠️" : "✅"}</span>
                      </td>
                      {HEADERS.map((col) => {
                        const val = row[col] ?? "";
                        const cellErr =
                          (col === "name" && !val.trim()) ||
                          (col === "state" && !val.trim()) ||
                          (col === "district" && !val.trim() && !!row.state?.trim() && normState(row.state) !== ALL_STATE);
                        const res = col === "state" ? resolved[idx].stateStatus
                                  : col === "district" ? resolved[idx].districtStatus : null;
                        if (res && res.status === "ambiguous" && res.candidates) {
                          return (
                            <td key={col} style={{ padding: "4px 6px" }}>
                              <select value={val} onChange={(e) => updateCell(idx, col, e.target.value)}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: "6px", fontSize: "12px", border: "1.5px solid #b7791f", color: "#034852", boxSizing: "border-box", minWidth: "90px" }}>
                                <option value={val}>{val} (keep)</option>
                                {res.candidates.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                          );
                        }
                        const corrected = !!res && res.status === "corrected";
                        return (
                          <td key={col} style={{ padding: "4px 6px" }}>
                            <input type="text" value={val}
                              onChange={(e) => updateCell(idx, col, e.target.value)}
                              style={{ width: "100%", padding: "5px 7px", borderRadius: "6px", fontSize: "12px", color: "#034852",
                                background: cellErr ? "rgba(229,62,62,0.04)" : corrected ? "rgba(10,190,98,0.06)" : "transparent",
                                border: cellErr ? "1.5px solid #e53e3e" : corrected ? "1.5px solid #0abe62" : "1px solid transparent",
                                outline: "none", boxSizing: "border-box", minWidth: "90px" }}
                              placeholder={cellErr ? "Required" : ""} />
                            {corrected && (
                              <span style={{ display: "block", fontSize: "10px", color: "#0abe62", fontWeight: 600 }}>
                                {val} → {res!.value}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: "6px 10px", minWidth: "120px" }}>
                        {hasErr && <span style={{ fontSize: "11px", color: "#e53e3e", fontWeight: 600 }}>{errs.join(", ")}</span>}
                        {warnsPerRow[idx].length > 0 && (
                          <span style={{ display: "block", fontSize: "11px", color: "#b7791f", fontWeight: 600 }}>
                            ⚠ {warnsPerRow[idx].join(", ")}
                          </span>
                        )}
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
            {rows.length} row{rows.length !== 1 ? "s" : ""} loaded. Click any cell to edit; use 🗑 to remove a row.
          </p>
        </div>
      )}

      {result && (
        <div style={{ marginTop: "20px", padding: "16px", borderRadius: "12px", background: "rgba(3,72,82,0.04)" }}>
          <p style={{ fontWeight: 700, color: "#034852", fontSize: "15px" }}>
            ✅ {result.created} school{result.created !== 1 ? "s" : ""} created
            {result.skipped > 0 && <>, ⚠️ {result.skipped} skipped</>}
          </p>
          {result.errors.length > 0 && (
            <ul style={{ marginTop: "10px", paddingLeft: "20px", fontSize: "12px", color: "#e53e3e", lineHeight: 1.8 }}>
              {result.errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
          {result.corrections.length > 0 && (
            <details style={{ marginTop: "8px" }}>
              <summary style={{ fontSize: "12px", color: "#0abe62", fontWeight: 700, cursor: "pointer" }}>
                {result.corrections.length} auto-correction{result.corrections.length === 1 ? "" : "s"}
              </summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "11px", color: "#0a7d4a", lineHeight: 1.7 }}>
                {result.corrections.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </details>
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
