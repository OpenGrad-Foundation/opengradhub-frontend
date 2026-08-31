"use client";

import { useMemo, useRef, useState } from "react";
import type { ParseDiagnostic } from "@/lib/api";

/**
 * Plain-textarea repair step for a bulk-imported quiz's SOURCE — the uploaded
 * .md/.txt text, or the text extracted from a PDF.
 *
 * This exists for the class of problems the structured preview cannot fix: a
 * missing `Q.n)` that merged two questions, a lost `[SECTION]` or
 * `[GROUP END]`, one typo repeated forty times. Fix the text, hit Reparse, and
 * the whole tree is rebuilt. Deliberately not a code editor: no CodeMirror, no
 * two-way sync — the source is the only truth until the author continues to
 * the preview.
 */

const SEV_ICON: Record<ParseDiagnostic["severity"], string> = {
  error: "⛔", warning: "⚠️", info: "ℹ️",
};

const S = {
  wrap: { display: "flex", flexDirection: "column", gap: "16px" } as React.CSSProperties,
  headline: {
    fontSize: "13px", color: "rgba(3,72,82,0.65)", margin: 0, lineHeight: 1.6,
  } as React.CSSProperties,
  issueList: {
    border: "1px solid rgba(3,72,82,0.12)", borderRadius: "12px",
    maxHeight: "180px", overflowY: "auto", background: "rgba(255,255,255,0.7)",
  } as React.CSSProperties,
  issueRow: {
    display: "flex", gap: "8px", alignItems: "baseline", width: "100%",
    padding: "8px 12px", border: "none", borderBottom: "1px solid rgba(3,72,82,0.06)",
    background: "transparent", cursor: "pointer", textAlign: "left" as const,
    fontSize: "12px", color: "#034852", fontFamily: "inherit",
  } as React.CSSProperties,
  textarea: {
    width: "100%", minHeight: "360px", padding: "14px",
    border: "1.5px solid rgba(3,72,82,0.15)", borderRadius: "12px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "13px", lineHeight: 1.55, color: "#034852",
    background: "#fff", resize: "vertical" as const, boxSizing: "border-box" as const,
  } as React.CSSProperties,
  smallInput: {
    flex: "1 1 120px", minWidth: 0, padding: "8px 10px",
    border: "1.5px solid rgba(3,72,82,0.15)", borderRadius: "8px",
    fontSize: "12px", color: "#034852", fontFamily: "inherit",
  } as React.CSSProperties,
  btn: {
    padding: "10px 20px", border: "1.5px solid rgba(3,72,82,0.15)", borderRadius: "10px",
    background: "transparent", color: "#034852", fontFamily: "var(--font-heading)",
    fontWeight: 700, fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,
  primaryBtn: {
    padding: "10px 24px", border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff",
    fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,
};

export function QuizSourceEditor({
  source,
  diagnostics,
  parsing,
  error,
  onReparse,
  onContinue,
  onCancel,
}: {
  source: string;
  diagnostics: ParseDiagnostic[];
  parsing: boolean;
  /** A hard parse failure (e.g. unterminated [START]) — shown above the text. */
  error: string | null;
  onReparse: (nextSource: string) => void;
  /** Advance to the structured preview with the last PARSED source. */
  onContinue: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(source);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The source prop changes only on a successful reparse; text is the draft.
  const dirty = text !== source;

  const listed = useMemo(
    () => diagnostics.filter((d) => d.severity !== "info"),
    [diagnostics],
  );
  const errorCount = listed.filter((d) => d.severity === "error").length;

  function jumpToLine(line: number) {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = text.split("\n");
    const start = lines.slice(0, line - 1).reduce((acc, l) => acc + l.length + 1, 0);
    const end = start + (lines[line - 1]?.length ?? 0);
    ta.focus();
    ta.setSelectionRange(start, end);
    // Rough but effective: scroll proportionally to the line's position.
    ta.scrollTop = Math.max(0, ((line - 3) / Math.max(1, lines.length)) * ta.scrollHeight);
  }

  function replaceAll() {
    if (!find) return;
    setText((t) => t.split(find).join(replace));
  }

  function downloadSource() {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quiz-corrected.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div style={S.wrap}>
      <p style={S.headline}>
        Some problems live in the file itself — a missing <code>Q.n)</code> line, a lost
        <code> [SECTION]</code>, a typo repeated on every question. Fix the text below and
        press <strong>Reparse</strong>; click an issue to jump to its line.
      </p>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.25)", color: "#c53030", fontSize: "13px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      {listed.length > 0 && (
        <div style={S.issueList} role="list" aria-label="Parse issues">
          {listed.map((d, i) => (
            <button
              key={d.id ?? i}
              type="button"
              role="listitem"
              style={S.issueRow}
              onClick={() => d.line && jumpToLine(d.line)}
              title={d.line ? `Jump to line ${d.line}` : undefined}
            >
              <span aria-hidden>{SEV_ICON[d.severity]}</span>
              {d.line != null && (
                <span style={{ fontWeight: 700, color: "rgba(3,72,82,0.45)", flexShrink: 0 }}>
                  L{d.line}
                </span>
              )}
              <span style={{ flex: 1 }}>{d.message}</span>
            </button>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
        style={S.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Quiz source"
      />

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          style={S.smallInput} placeholder="Find…" value={find}
          onChange={(e) => setFind(e.target.value)} aria-label="Find text"
        />
        <input
          style={S.smallInput} placeholder="Replace with…" value={replace}
          onChange={(e) => setReplace(e.target.value)} aria-label="Replace with"
        />
        <button type="button" style={S.btn} onClick={replaceAll} disabled={!find}>
          Replace all
        </button>
        <button type="button" style={{ ...S.btn, marginLeft: "auto" }} onClick={downloadSource}>
          ↓ Download corrected source
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap-reverse", borderTop: "1px solid rgba(3,72,82,0.08)", paddingTop: "14px" }}>
        <button type="button" style={S.btn} onClick={onCancel} disabled={parsing}>
          ← Cancel
        </button>
        <button
          type="button"
          style={{ ...S.primaryBtn, opacity: parsing ? 0.6 : 1 }}
          onClick={() => onReparse(text)}
          disabled={parsing}
        >
          {parsing ? "Parsing…" : "Reparse ↻"}
        </button>
        <button
          type="button"
          style={{ ...S.btn, marginLeft: "auto", opacity: dirty ? 0.6 : 1 }}
          onClick={onContinue}
          disabled={parsing || dirty}
          title={dirty ? "Reparse your edits first" : errorCount > 0 ? "Errors can also be fixed in the preview panel" : undefined}
        >
          Continue to preview →
        </button>
      </div>
    </div>
  );
}
