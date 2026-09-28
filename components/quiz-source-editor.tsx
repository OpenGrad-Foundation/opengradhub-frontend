"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ParsedBulkQuiz, ParsedQuestion, ParseDiagnostic } from "@/lib/api";
import { countBySeverity, diagsForQuestion } from "@/lib/quiz-import-diagnostics";
import { applySourceFix, diagnosticJumpLine, sourceFixLabel } from "@/lib/quiz-source-fixes";
import { QuizIssueTree } from "@/components/quiz-issue-tree";

/**
 * Full-screen repair workbench for a bulk-imported quiz's SOURCE — the
 * uploaded .md/.txt text, or the text extracted from a PDF.
 *
 * Three panes: the source (plain textarea + line gutter), the issues list
 * (click → jump; every issue with a safe text-level repair gets a Fix button
 * that edits the text for you), and a live outline of the quiz as it will be
 * saved. Edits reparse automatically after a short pause, so the outline and
 * the issue list follow your typing.
 *
 * Deliberately not a code editor: no CodeMirror, no two-way sync. The source
 * is the only truth until the author continues to the structured preview.
 */

const AUTO_REPARSE_MS = 700;

const SEV_ICON: Record<ParseDiagnostic["severity"], string> = { error: "⛔", warning: "⚠️", info: "ℹ️" };

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const LINE_H = 21; // px — gutter and textarea must agree

const S = {
  card: {
    background: "#fff", border: "1px solid rgba(3,72,82,0.10)", borderRadius: "14px",
    display: "flex", flexDirection: "column" as const, minHeight: 0, overflow: "hidden",
  } as React.CSSProperties,
  cardHead: {
    padding: "10px 14px", borderBottom: "1px solid rgba(3,72,82,0.08)",
    fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
    color: "rgba(3,72,82,0.6)", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
  } as React.CSSProperties,
  btn: {
    padding: "8px 16px", border: "1.5px solid rgba(3,72,82,0.15)", borderRadius: "10px",
    background: "#fff", color: "#034852", fontFamily: "var(--font-heading)",
    fontWeight: 700, fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  primaryBtn: {
    padding: "8px 20px", border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff",
    fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
  smallInput: {
    flex: "1 1 110px", minWidth: 0, padding: "6px 10px",
    border: "1.5px solid rgba(3,72,82,0.15)", borderRadius: "8px",
    fontSize: "12px", color: "#034852", fontFamily: "inherit",
  } as React.CSSProperties,
  miniBtn: {
    padding: "3px 10px", borderRadius: "7px", fontSize: "11px", fontWeight: 700,
    border: "1.5px solid rgba(3,72,82,0.15)", background: "#fff", color: "#034852",
    cursor: "pointer", whiteSpace: "nowrap" as const,
  } as React.CSSProperties,
};

export function QuizSourceEditor({
  source,
  quiz,
  diagnostics,
  parsing,
  error,
  onReparse,
  onContinue,
  onCancel,
}: {
  source: string;
  /** Last successful parse of `source` (null after a hard parse failure). */
  quiz: ParsedBulkQuiz | null;
  diagnostics: ParseDiagnostic[];
  parsing: boolean;
  /** A hard parse failure (e.g. unterminated [START]) — shown above the issues. */
  error: string | null;
  onReparse: (nextSource: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(source);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [issuesFolded, setIssuesFolded] = useState(false);
  // Fixes already applied to the DRAFT text. Until the reparse round-trips,
  // the stale diagnostic is still in the list — without this, a second click
  // on "Add [SUBJECT] line" would insert a second line. Cleared whenever a
  // fresh parse result replaces the diagnostics.
  const [appliedIds, setAppliedIds] = useState<Set<string>>(() => new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const dirty = text !== source;

  // Auto-reparse: a pause after the last keystroke re-runs the parser so the
  // issues and the outline follow the edit. Refs keep the timer from firing
  // with a stale view of `parsing`/`source`.
  const parsingRef = useRef(parsing);
  parsingRef.current = parsing;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  useEffect(() => {
    if (text === sourceRef.current) return;
    const t = setTimeout(() => {
      if (!parsingRef.current && text !== sourceRef.current) onReparse(text);
    }, AUTO_REPARSE_MS);
    return () => clearTimeout(t);
    // onReparse is stable enough for this purpose; re-arming per text change is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => { setAppliedIds(new Set()); }, [diagnostics]);

  const listed = useMemo(() => diagnostics.filter((d) => d.severity !== "info"), [diagnostics]);
  const { errors, warnings } = countBySeverity(listed);
  const lineCount = useMemo(() => text.split("\n").length, [text]);

  function focusLine(line: number, { selectLine = true, caretAtEnd = false } = {}) {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = text.split("\n");
    const clamped = Math.min(Math.max(1, line), lines.length);
    const start = lines.slice(0, clamped - 1).reduce((acc, l) => acc + l.length + 1, 0);
    const end = start + (lines[clamped - 1]?.length ?? 0);
    ta.focus();
    if (caretAtEnd) ta.setSelectionRange(end, end);
    else if (selectLine) ta.setSelectionRange(start, end);
    // Scroll so the line sits about a third of the way down.
    ta.scrollTop = Math.max(0, (clamped - 1) * LINE_H - ta.clientHeight / 3);
    setActiveLine(clamped);
  }

  // After a programmatic text change, focus once the textarea has re-rendered.
  const pendingFocus = useRef<{ line: number; caretAtEnd: boolean } | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const { line, caretAtEnd } = pendingFocus.current;
    pendingFocus.current = null;
    focusLine(line, { caretAtEnd, selectLine: !caretAtEnd });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function jumpTo(d: ParseDiagnostic) {
    const line = diagnosticJumpLine(d, quiz);
    if (line != null) focusLine(line);
  }

  function fix(d: ParseDiagnostic) {
    if (d.id != null && appliedIds.has(d.id)) return; // already applied this round
    const r = applySourceFix(text, d, quiz);
    if (!r) { jumpTo(d); return; }
    pendingFocus.current = { line: r.cursorLine, caretAtEnd: !!r.needsInput };
    setText(r.text);
    if (d.id != null) setAppliedIds((prev) => new Set(prev).add(d.id!));
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

  const status = parsing
    ? "Reparsing…"
    : dirty
      ? "Edited — reparse pending"
      : quiz
        ? `${errors} error${errors !== 1 ? "s" : ""} · ${warnings} warning${warnings !== 1 ? "s" : ""}`
        : "Not parsed yet";

  return (
    <div
      role="dialog"
      aria-label="Fix the quiz source"
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "#f0f2f5",
        display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif", color: "#034852",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          padding: "12px 18px", background: "#fff", borderBottom: "1px solid rgba(3,72,82,0.10)", flexShrink: 0,
        }}
      >
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "18px" }}>Fix the source</div>
        <div
          style={{
            fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "100px",
            background: errors > 0 ? "rgba(229,62,62,0.10)" : warnings > 0 ? "rgba(255,222,0,0.22)" : "rgba(10,190,98,0.12)",
            color: errors > 0 ? "#c53030" : warnings > 0 ? "#956f00" : "#0f6b58",
          }}
          role="status"
        >
          {status}
        </div>
        <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
          Edits reparse automatically. Click an issue to jump; <strong>Fix</strong> edits the text for you.
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" style={S.btn} onClick={onCancel} disabled={parsing}>← Cancel</button>
          <button type="button" style={S.btn} onClick={downloadSource}>↓ Download</button>
          <button
            type="button"
            style={{ ...S.btn, opacity: parsing ? 0.6 : 1 }}
            onClick={() => onReparse(text)}
            disabled={parsing}
          >
            Reparse ↻
          </button>
          <button
            type="button"
            style={{ ...S.primaryBtn, opacity: parsing || dirty || !quiz ? 0.55 : 1 }}
            onClick={onContinue}
            disabled={parsing || dirty || !quiz}
            title={dirty ? "Wait for the reparse (or press Reparse)" : !quiz ? "Fix the parse error first" : undefined}
          >
            Continue to preview →
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1, minHeight: 0, padding: "12px", gap: "12px",
          display: "grid", gridTemplateColumns: "minmax(0, 11fr) minmax(0, 9fr)",
        }}
      >
        {/* Left: source */}
        <div style={S.card}>
          <div style={S.cardHead}>
            Source
            <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(3,72,82,0.45)" }}>
              {lineCount} lines{activeLine ? ` · line ${activeLine}` : ""}
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <div
              ref={gutterRef}
              aria-hidden
              style={{
                width: "48px", flexShrink: 0, overflow: "hidden", background: "rgba(3,72,82,0.03)",
                borderRight: "1px solid rgba(3,72,82,0.08)", fontFamily: MONO, fontSize: "12px",
                lineHeight: `${LINE_H}px`, padding: "12px 0", textAlign: "right", color: "rgba(3,72,82,0.4)",
                userSelect: "none",
              }}
            >
              {Array.from({ length: lineCount }, (_, i) => (
                <div
                  key={i}
                  style={{
                    paddingRight: "8px",
                    fontWeight: activeLine === i + 1 ? 800 : 400,
                    color: activeLine === i + 1 ? "#006d6c" : undefined,
                    background: activeLine === i + 1 ? "rgba(10,190,98,0.12)" : undefined,
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onScroll={(e) => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }}
              onClick={(e) => {
                const pos = e.currentTarget.selectionStart;
                setActiveLine(text.slice(0, pos).split("\n").length);
              }}
              onKeyUp={(e) => {
                const pos = e.currentTarget.selectionStart;
                setActiveLine(text.slice(0, pos).split("\n").length);
              }}
              spellCheck={false}
              aria-label="Quiz source"
              style={{
                flex: 1, minWidth: 0, border: "none", outline: "none", resize: "none",
                padding: "12px 14px", fontFamily: MONO, fontSize: "13px", lineHeight: `${LINE_H}px`,
                color: "#034852", background: "#fff", whiteSpace: "pre", overflow: "auto",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(3,72,82,0.08)", flexShrink: 0 }}>
            <input style={S.smallInput} placeholder="Find…" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find text" />
            <input style={S.smallInput} placeholder="Replace with…" value={replace} onChange={(e) => setReplace(e.target.value)} aria-label="Replace with" />
            <button type="button" style={S.miniBtn} onClick={replaceAll} disabled={!find}>Replace all</button>
          </div>
        </div>

        {/* Right: issues + outline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>
          <div style={{ ...S.card, flex: issuesFolded ? "0 0 auto" : "0 1 42%", maxHeight: issuesFolded ? undefined : "42%" }}>
            <div
              style={{ ...S.cardHead, cursor: "pointer", userSelect: "none" }}
              onClick={() => setIssuesFolded((f) => !f)}
              role="button"
              aria-expanded={!issuesFolded}
            >
              <span aria-hidden style={{ fontSize: "10px", display: "inline-block", transform: issuesFolded ? "none" : "rotate(90deg)", transition: "transform 120ms" }}>▶</span>
              Issues
              <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(3,72,82,0.45)" }}>
                {listed.length === 0 && !error ? "none" : `${errors} error${errors !== 1 ? "s" : ""} · ${warnings} warning${warnings !== 1 ? "s" : ""}`}
              </span>
              <span style={{ marginLeft: "auto", fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(3,72,82,0.4)" }}>
                {issuesFolded ? "show" : "hide"}
              </span>
            </div>
            {!issuesFolded && (
              <div style={{ overflowY: "auto", minHeight: 0 }}>
                {error && (
                  <div style={{ margin: "10px 12px", padding: "10px 12px", borderRadius: "10px", background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.25)", color: "#c53030", fontSize: "12px", fontWeight: 600 }}>
                    ⛔ {error}
                  </div>
                )}
                {listed.length === 0 && !error ? (
                  <div style={{ padding: "16px 14px", fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
                    No issues. Continue to the preview to review tags and save.
                  </div>
                ) : (
                  <QuizIssueTree
                    quiz={quiz}
                    diagnostics={listed}
                    activeLine={activeLine}
                    appliedIds={appliedIds}
                    onItemClick={jumpTo}
                    onGroupClick={(g) => { if (g.line) focusLine(g.line); }}
                    itemAction={(d) => {
                      const label = sourceFixLabel(d);
                      return label ? { label, onClick: () => fix(d) } : null;
                    }}
                  />
                )}
              </div>
            )}
          </div>

          <div style={{ ...S.card, flex: 1 }}>
            <div style={S.cardHead}>
              Quiz preview
              <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(3,72,82,0.45)" }}>
                as it will be saved · click a question to jump
              </span>
            </div>
            <div style={{ overflowY: "auto", minHeight: 0, padding: "12px" }}>
              <QuizOutline quiz={quiz} diagnostics={listed} onJump={(line) => focusLine(line)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Live outline of the parsed quiz ──────────────────────────────────────────

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/** Inline <img> tags the parser embedded from [IMAGE] lines (stem, options, solution). */
const imageCount = (q: ParsedQuestion): number => {
  const count = (t?: string) => (t?.match(/<img\b/gi) ?? []).length;
  return count(q.content) + count(q.solution) + q.options.reduce((n, o) => n + count(o.text), 0);
};

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  MCQ: { bg: "rgba(32,147,121,0.12)", color: "#209379" },
  FILL: { bg: "rgba(10,190,98,0.12)", color: "#0abe62" },
  NUMERICAL: { bg: "rgba(255,222,0,0.2)", color: "#956f00" },
  GROUP: { bg: "rgba(3,72,82,0.1)", color: "#034852" },
  ESSAY: { bg: "rgba(147,32,121,0.12)", color: "#932079" },
};

function Chip({ label, value }: { label: string; value?: string | number | null }) {
  const missing = value == null || value === "";
  return (
    <span
      style={{
        fontSize: "10px", fontWeight: 600, padding: "1px 8px", borderRadius: "100px", whiteSpace: "nowrap",
        border: missing ? "1px dashed rgba(229,62,62,0.5)" : "1px solid rgba(3,72,82,0.15)",
        color: missing ? "#c53030" : "rgba(3,72,82,0.7)",
        background: missing ? "rgba(229,62,62,0.04)" : "rgba(3,72,82,0.03)",
      }}
    >
      {missing ? `no ${label}` : `${label}: ${value}`}
    </span>
  );
}

function OutlineQuestion({
  q, issues, onJump, nested,
}: {
  q: ParsedQuestion; issues: { errors: number; warnings: number }; onJump: (line: number) => void; nested?: boolean;
}) {
  const tc = TYPE_COLORS[q.question_type] ?? { bg: "rgba(0,0,0,0.06)", color: "#444" };
  const text = stripHtml(q.content);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); if (q.line) onJump(q.line); }}
      style={{
        border: `1px solid ${issues.errors > 0 ? "rgba(229,62,62,0.35)" : issues.warnings > 0 ? "rgba(255,170,0,0.4)" : "rgba(3,72,82,0.10)"}`,
        borderRadius: "10px", padding: "10px 12px", marginBottom: "8px", cursor: q.line ? "pointer" : "default",
        background: nested ? "rgba(3,72,82,0.02)" : "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
        <span style={{ fontWeight: 800, fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>
          {q.question_type === "GROUP" ? "GROUP" : `Q.${q.number ?? "?"}`}
        </span>
        <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 8px", borderRadius: "100px", background: tc.bg, color: tc.color }}>
          {q.question_type}
        </span>
        {q.marks != null && <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>{q.marks}m</span>}
        {issues.errors > 0 && <span style={{ fontSize: "10px", fontWeight: 800, color: "#fff", background: "#e53e3e", borderRadius: "100px", padding: "1px 7px" }}>{issues.errors} ⛔</span>}
        {issues.warnings > 0 && <span style={{ fontSize: "10px", fontWeight: 800, color: "#956f00", background: "rgba(255,222,0,0.3)", borderRadius: "100px", padding: "1px 7px" }}>{issues.warnings} ⚠</span>}
        {q.line && <span style={{ marginLeft: "auto", fontSize: "10px", color: "rgba(3,72,82,0.35)", fontFamily: MONO }}>L{q.line}</span>}
      </div>
      <div style={{ fontSize: "13px", lineHeight: 1.45, color: text ? "#034852" : "#c53030", fontStyle: text ? undefined : "italic" }}>
        {text || "(no question text)"}
      </div>
      {q.options.length > 0 && (
        <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "2px" }}>
          {q.options.map((o, i) => (
            <li key={i} style={{ fontSize: "12px", display: "flex", gap: "6px", color: o.is_correct ? "#0f6b58" : "rgba(3,72,82,0.7)", fontWeight: o.is_correct ? 700 : 400 }}>
              <span style={{ width: "14px", flexShrink: 0 }}>{o.is_correct ? "✓" : "○"}</span>
              <span>{stripHtml(o.text) || "(empty option)"}</span>
            </li>
          ))}
        </ul>
      )}
      {(q.question_type === "NUMERICAL" || q.question_type === "FILL") && (
        <div style={{ fontSize: "12px", marginTop: "6px", color: q.correct_answer ? "#0f6b58" : "#c53030", fontWeight: 600 }}>
          Answer: {q.correct_answer || "(missing)"}{q.tolerance ? ` ± ${q.tolerance}` : ""}
        </div>
      )}
      {q.question_type !== "GROUP" && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
          <Chip label="subject" value={q.subject} />
          <Chip label="topic" value={q.topic} />
          <Chip label="difficulty" value={q.difficulty} />
          {q.tag && <Chip label="tag" value={q.tag} />}
          {imageCount(q) > 0 && (
            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 8px", borderRadius: "100px", border: "1px solid rgba(3,72,82,0.15)", color: "rgba(3,72,82,0.7)" }}>
              🖼 {imageCount(q)} image{imageCount(q) !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
      {q.question_type === "GROUP" && (
        <div style={{ marginTop: "8px", paddingLeft: "10px", borderLeft: "3px solid rgba(3,72,82,0.12)" }}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
            <Chip label="subject" value={q.subject} />
            <Chip label="topic" value={q.topic} />
          </div>
          {(q.children ?? []).map((c, i) => (
            <OutlineQuestion key={i} q={c} issues={{ errors: 0, warnings: 0 }} onJump={onJump} nested />
          ))}
          {(q.children ?? []).length === 0 && (
            <div style={{ fontSize: "12px", color: "#c53030", fontStyle: "italic" }}>(no child questions)</div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizOutline({
  quiz, diagnostics, onJump,
}: { quiz: ParsedBulkQuiz | null; diagnostics: ParseDiagnostic[]; onJump: (line: number) => void }) {
  if (!quiz) {
    return (
      <div style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", padding: "8px" }}>
        Nothing parsed yet — fix the error on the left and the outline will appear here.
      </div>
    );
  }
  const total = quiz.sections.reduce((n, s) => n + s.questions.length, 0);
  return (
    <div>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: "15px", color: quiz.title ? "#034852" : "#c53030" }}>
          {quiz.title || "(no title — add [TEST TITLE])"}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)", marginTop: "2px" }}>
          {quiz.sections.length} section{quiz.sections.length !== 1 ? "s" : ""} · {total} question{total !== 1 ? "s" : ""}
          {quiz.duration_minutes != null ? ` · ${quiz.duration_minutes} min` : " · no duration"}
        </div>
      </div>
      {quiz.sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: "14px" }}>
          <div
            onClick={() => sec.line && onJump(sec.line)}
            style={{
              fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: "rgba(3,72,82,0.55)", marginBottom: "6px", cursor: sec.line ? "pointer" : "default",
              display: "flex", justifyContent: "space-between",
            }}
          >
            <span>{sec.title} · {sec.questions.length} Q</span>
            {sec.line && <span style={{ fontFamily: MONO, fontWeight: 400 }}>L{sec.line}</span>}
          </div>
          {sec.questions.length === 0 && (
            <div style={{ fontSize: "12px", color: "#c53030", fontStyle: "italic", marginBottom: "8px" }}>(empty section)</div>
          )}
          {sec.questions.map((q, qi) => (
            <OutlineQuestion
              key={qi}
              q={q}
              issues={countBySeverity(diagsForQuestion(diagnostics, si, qi))}
              onJump={onJump}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
