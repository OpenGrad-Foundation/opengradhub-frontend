"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ParsedBulkQuiz, ParsedQuestion, ParsedOption, ParseDiagnostic, QuestionFacets } from "@/lib/api";
import { bulkValidateQuiz, getQuestionFacets } from "@/lib/api";
import { sanitize } from "@/lib/purify";
import { RichTextEditor } from "@/components/rich-text-editor";
import { QuizStudentPreview } from "@/components/quiz-student-preview";
import type { Quiz, Question, QuizSection } from "@/lib/api";
import { QUESTION_DIFFICULTIES } from "@/lib/question-difficulties";
import {
  applyDiagnosticFix,
  countBySeverity,
  diagsForQuestion,
  splitDiagnostics,
  type FixMode,
} from "@/lib/quiz-import-diagnostics";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionAddress = { sIdx: number; qIdx: number } | null;

// ── Styles ────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  MCQ:       { bg: "rgba(32,147,121,0.12)",  color: "#209379" },
  FILL:      { bg: "rgba(10,190,98,0.12)",   color: "#0abe62" },
  NUMERICAL: { bg: "rgba(255,222,0,0.2)",    color: "#956f00" },
  GROUP:     { bg: "rgba(3,72,82,0.1)",      color: "#034852" },
  ESSAY:     { bg: "rgba(147,32,121,0.12)",  color: "#932079" },
};

function typeBadgeStyle(type: string): React.CSSProperties {
  const { bg, color } = TYPE_COLORS[type] ?? { bg: "rgba(0,0,0,0.06)", color: "#444" };
  return {
    display: "inline-block", padding: "3px 9px", borderRadius: "100px",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", background: bg, color,
    whiteSpace: "nowrap" as const, flexShrink: 0,
  };
}

const S = {
  sectionCard: {
    background: "rgba(255,255,255,0.98)",
    border: "1px solid rgba(3,72,82,0.1)",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  } as React.CSSProperties,

  sectionHeader: {
    background: "linear-gradient(135deg, rgba(3,72,82,0.06) 0%, rgba(10,190,98,0.06) 100%)",
    borderBottom: "1px solid rgba(3,72,82,0.08)",
    padding: "14px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  } as React.CSSProperties,

  sectionTitle: {
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "15px",
    color: "#034852",
    margin: 0,
  } as React.CSSProperties,

  questionRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(3,72,82,0.05)",
    cursor: "pointer",
    transition: "background 120ms ease",
  } as React.CSSProperties,

  primaryBtn: {
    padding: "11px 24px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#fff",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(10,190,98,0.2)",
  } as React.CSSProperties,

  secondaryBtn: {
    padding: "11px 24px",
    border: "1.5px solid rgba(3,72,82,0.15)",
    borderRadius: "12px",
    background: "transparent",
    color: "#034852",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
  } as React.CSSProperties,

  actionBar: {
    display: "flex",
    gap: "12px",
    paddingTop: "8px",
    borderTop: "1px solid rgba(3,72,82,0.08)",
    marginTop: "8px",
  } as React.CSSProperties,

  // Panel styles
  panelInput: {
    width: "100%",
    padding: "8px 10px",
    border: "1.5px solid rgba(3,72,82,0.15)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#034852",
    background: "#fff",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  panelTextarea: {
    width: "100%",
    padding: "8px 10px",
    border: "1.5px solid rgba(3,72,82,0.15)",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#034852",
    background: "#fff",
    resize: "vertical" as const,
    fontFamily: "inherit",
    minHeight: "72px",
    boxSizing: "border-box" as const,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "rgba(3,72,82,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    marginBottom: "5px",
    display: "block",
  } as React.CSSProperties,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncateText(text: string, maxLen = 90): string {
  const clean = text.replace(/<[^>]*>/g, "").trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + "…" : clean;
}

// ── Option editor (used inside panel) ────────────────────────────────────────

function OptionEditor({
  options,
  onChange,
}: {
  options: ParsedOption[];
  onChange: (opts: ParsedOption[]) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {options.map((opt, idx) => {
        const hasHtml = /<[a-z][\s\S]*>/i.test(opt.text);
        return (
          <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                title={opt.is_correct ? "Correct answer" : "Mark as correct"}
                onClick={() =>
                  onChange(options.map((o, i) => (i === idx ? { ...o, is_correct: !o.is_correct } : o)))
                }
                style={{
                  width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${opt.is_correct ? "#0abe62" : "rgba(3,72,82,0.2)"}`,
                  background: opt.is_correct ? "#0abe62" : "transparent",
                  cursor: "pointer", padding: 0,
                }}
              />
              <input
                style={{ ...S.panelInput, flex: 1 }}
                value={opt.text}
                onChange={(e) =>
                  onChange(options.map((o, i) => (i === idx ? { ...o, text: e.target.value } : o)))
                }
              />
            </div>
            {hasHtml && (
              <div 
                style={{ 
                  marginLeft: "24px", 
                  padding: "6px 10px", 
                  background: "rgba(3,72,82,0.02)", 
                  border: "1px dashed rgba(3,72,82,0.2)",
                  borderRadius: "6px",
                  fontSize: "13px",
                  overflow: "auto"
                }}
                dangerouslySetInnerHTML={{ __html: sanitize(opt.text) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Html Field Editor ─────────────────────────────────────────────────────────

function HtmlFieldEditor({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  disableImageUpload,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  placeholder?: string;
  disableImageUpload?: boolean;
}) {
  return (
    <div>
      <span style={{ ...S.fieldLabel, marginBottom: "5px" }}>{label}</span>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={Math.max(rows * 20, 72)}
        disableImageUpload={disableImageUpload}
      />
    </div>
  );
}

// ── Full question editor panel body ───────────────────────────────────────────

function QuestionEditorForm({
  question,
  onChange,
}: {
  question: ParsedQuestion;
  onChange: (q: ParsedQuestion) => void;
}) {
  const set = <K extends keyof ParsedQuestion>(key: K, val: ParsedQuestion[K]) =>
    onChange({ ...question, [key]: val });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {question.instruction !== undefined && (
        <HtmlFieldEditor
          label="Instruction / Passage"
          value={question.instruction ?? ""}
          onChange={(val) => set("instruction", val || undefined)}
          rows={3}
          disableImageUpload
        />
      )}

      <HtmlFieldEditor
        label="Question"
        value={question.content}
        onChange={(val) => set("content", val)}
        rows={4}
      />

      {question.question_type === "MCQ" && question.options.length > 0 && (
        <div>
          <span style={S.fieldLabel}>Options — click circle to mark correct</span>
          <OptionEditor options={question.options} onChange={(opts) => set("options", opts)} />
        </div>
      )}

      {(question.question_type === "NUMERICAL" || question.question_type === "FILL") &&
        question.correct_answer != null && (
          <div>
            <span style={S.fieldLabel}>Correct Answer</span>
            <input
              style={{ ...S.panelInput, maxWidth: "240px" }}
              value={question.correct_answer}
              onChange={(e) => set("correct_answer", e.target.value)}
            />
          </div>
        )}

      {question.question_type === "GROUP" && (question.children ?? []).length > 0 && (
        <div>
          <span style={S.fieldLabel}>Child Questions</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderLeft: "3px solid rgba(3,72,82,0.12)", paddingLeft: "14px" }}>
            {question.children!.map((child, cidx) => (
              <div key={cidx} style={{ background: "rgba(3,72,82,0.03)", borderRadius: "8px", padding: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(3,72,82,0.4)" }}>
                    {cidx + 1}.
                  </span>
                  <span style={typeBadgeStyle(child.question_type)}>{child.question_type}</span>
                </div>
                <QuestionEditorForm
                  question={child}
                  onChange={(updated) =>
                    set("children", question.children!.map((c, i) => (i === cidx ? updated : c)))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {(["subject", "topic", "tag"] as const).map((field) => (
          <div key={field}>
            <span style={S.fieldLabel}>{field}</span>
            <input
              style={S.panelInput}
              value={(question[field] as string | undefined) ?? ""}
              placeholder="—"
              list={`og-${field}-list`}
              onChange={(e) => set(field, e.target.value || undefined)}
            />
          </div>
        ))}
        <div>
          <span style={S.fieldLabel}>difficulty</span>
          <select
            style={S.panelInput}
            value={question.difficulty ?? ""}
            onChange={(e) => set("difficulty", e.target.value || undefined)}
          >
            <option value="">—</option>
            {QUESTION_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            {question.difficulty &&
              !(QUESTION_DIFFICULTIES as readonly string[]).includes(question.difficulty) && (
                <option value={question.difficulty}>{question.difficulty} (unrecognised)</option>
              )}
          </select>
        </div>
        <div>
          <span style={S.fieldLabel}>Marks</span>
          <input
            style={S.panelInput}
            type="number"
            value={question.marks ?? ""}
            placeholder="—"
            onChange={(e) => set("marks", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <span style={S.fieldLabel}>−ve Marks</span>
          <input
            style={S.panelInput}
            type="number"
            value={question.negative_marks ?? ""}
            placeholder="—"
            onChange={(e) =>
              set("negative_marks", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>
      </div>



      <HtmlFieldEditor
        label="Solution (optional)"
        value={question.solution ?? ""}
        placeholder="Explanation shown after submission..."
        onChange={(val) => set("solution", val || undefined)}
        rows={3}
      />
    </div>
  );
}

// ── Side panel ────────────────────────────────────────────────────────────────

function QuestionPanel({
  question,
  sIdx,
  qIdx,
  onClose,
  onChange,
  diagnostics,
  onResolve,
  suggestions,
}: {
  question: ParsedQuestion;
  sIdx: number;
  qIdx: number;
  onClose: () => void;
  onChange: (q: ParsedQuestion) => void;
  /** Unresolved SYNTACTIC diagnostics for this question (children included). */
  diagnostics: ParseDiagnostic[];
  onResolve: (diag: ParseDiagnostic, mode: FixMode | "ignore") => void;
  /** Datalist suggestions: in-file values first, then the question bank. */
  suggestions: { subjects: string[]; topics: Array<{ value: string; subject: string | null }>; tags: string[] };
}) {
  // Topics that belong to this question's subject come first in the list.
  const subjectKey = question.subject?.trim().toLowerCase() ?? null;
  const orderedTopics = subjectKey
    ? [
        ...suggestions.topics.filter((t) => t.subject?.trim().toLowerCase() === subjectKey),
        ...suggestions.topics.filter((t) => t.subject?.trim().toLowerCase() !== subjectKey),
      ]
    : suggestions.topics;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(3,72,82,0.2)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
          width: "min(480px, 96vw)",
          background: "#fff",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.14)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(3,72,82,0.08)",
            background: "linear-gradient(135deg, rgba(3,72,82,0.04) 0%, rgba(10,190,98,0.04) 100%)",
            display: "flex", alignItems: "center", gap: "10px", flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.4)",
              minWidth: "28px",
            }}
          >
            Q{qIdx + 1}
          </span>
          <span style={typeBadgeStyle(question.question_type)}>{question.question_type}</span>
          {question.marks != null && (
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>
              {question.marks} mark{question.marks !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto", background: "none", border: "none",
              fontSize: "18px", color: "rgba(3,72,82,0.4)", cursor: "pointer",
              lineHeight: 1, padding: "2px 6px", borderRadius: "6px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Panel body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {diagnostics.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
              {diagnostics.map((d, i) => (
                <DiagnosticFixCard key={d.id ?? i} diag={d} onResolve={onResolve} />
              ))}
            </div>
          )}
          <QuestionEditorForm question={question} onChange={onChange} />
          {/* Suggestion datalists for the subject/topic/tag inputs above. */}
          <datalist id="og-subject-list">
            {suggestions.subjects.map((v) => <option key={v} value={v} />)}
          </datalist>
          <datalist id="og-topic-list">
            {orderedTopics.map((t) => <option key={t.value} value={t.value} />)}
          </datalist>
          <datalist id="og-tag-list">
            {suggestions.tags.map((v) => <option key={v} value={v} />)}
          </datalist>
        </div>

        {/* Panel footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid rgba(3,72,82,0.08)",
            display: "flex", justifyContent: "flex-end", flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{ ...S.primaryBtn, padding: "10px 28px", fontSize: "14px" }}
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}

// ── Diagnostic fix card ───────────────────────────────────────────────────────

/**
 * One unresolved parser diagnostic and its dispositions. A quarantined line
 * (an UNKNOWN_TAG typo) is not in the quiz data at all — it lives here until
 * the author applies it as the intended field, appends it to the question
 * text, or discards it. An appended line (warnings) can be moved or stripped.
 */
function DiagnosticFixCard({
  diag,
  onResolve,
}: {
  diag: ParseDiagnostic;
  onResolve: (diag: ParseDiagnostic, mode: FixMode | "ignore") => void;
}) {
  const isError = diag.severity === "error";
  const quarantined = diag.raw != null && diag.fix?.from == null;
  const canApply = diag.fix?.field != null && diag.fix.value != null;
  const btn: React.CSSProperties = {
    padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
    border: "1.5px solid rgba(3,72,82,0.15)", background: "#fff", color: "#034852",
    cursor: "pointer",
  };
  return (
    <div
      style={{
        border: `1.5px solid ${isError ? "rgba(229,62,62,0.35)" : "rgba(255,170,0,0.4)"}`,
        background: isError ? "rgba(229,62,62,0.04)" : "rgba(255,222,0,0.06)",
        borderRadius: "10px", padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: "8px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, color: isError ? "#c53030" : "#956f00" }}>
        {isError ? "⛔" : "⚠️"} {diag.message}
        {diag.line != null && (
          <span style={{ fontWeight: 400, opacity: 0.7 }}> (line {diag.line})</span>
        )}
      </div>
      {diag.raw && (
        <code
          style={{
            display: "block", padding: "6px 10px", borderRadius: "6px",
            background: "rgba(3,72,82,0.05)", fontSize: "12px", color: "#034852",
            overflowX: "auto", whiteSpace: "pre",
          }}
        >
          {diag.raw}
        </code>
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {canApply && (
          <button
            type="button"
            style={{ ...btn, borderColor: "#0abe62", color: "#0f6b58", fontWeight: 700 }}
            onClick={() => onResolve(diag, "apply")}
          >
            ✓ Apply as {String(diag.fix!.field)} = “{String(diag.fix!.value)}”
          </button>
        )}
        {quarantined && (
          <button type="button" style={btn} onClick={() => onResolve(diag, "append")}>
            Append to question text
          </button>
        )}
        <button type="button" style={btn} onClick={() => onResolve(diag, "discard")}>
          Discard line
        </button>
        {!isError && (
          <button type="button" style={{ ...btn, opacity: 0.7 }} onClick={() => onResolve(diag, "ignore")}>
            Ignore
          </button>
        )}
      </div>
    </div>
  );
}

// ── Compact question row ──────────────────────────────────────────────────────

/** Missing-tag chips, computed straight from the data (display, not a rule). */
function missingTagChips(q: ParsedQuestion): string[] {
  const chips: string[] = [];
  if (!q.subject?.trim()) chips.push("no subject");
  if (!q.topic?.trim()) chips.push("no topic");
  if (q.question_type !== "GROUP" && !q.difficulty?.trim()) chips.push("no difficulty");
  return chips;
}

function QuestionRowItem({
  question,
  index,
  isLast,
  onEdit,
  issues,
}: {
  question: ParsedQuestion;
  index: number;
  isLast: boolean;
  onEdit: () => void;
  issues: { errors: number; warnings: number };
}) {
  const [hovered, setHovered] = useState(false);
  const chips = missingTagChips(question);

  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.questionRow,
        background: hovered ? "rgba(3,72,82,0.025)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid rgba(3,72,82,0.05)",
      }}
    >
      <span
        style={{
          fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.35)",
          minWidth: "28px", flexShrink: 0,
        }}
      >
        {index + 1}.
      </span>

      <span style={typeBadgeStyle(question.question_type)}>{question.question_type}</span>

      <span
        style={{
          flex: 1, minWidth: 0,
          fontSize: "13px", fontWeight: 500, color: "#034852",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {truncateText(question.content)}
      </span>

      {question.marks != null && (
        <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.4)", flexShrink: 0 }}>
          {question.marks}m
        </span>
      )}

      {issues.errors > 0 && (
        <span
          title={`${issues.errors} error${issues.errors !== 1 ? "s" : ""}`}
          style={{
            flexShrink: 0, fontSize: "10px", fontWeight: 800, color: "#fff",
            background: "#e53e3e", borderRadius: "100px", padding: "2px 8px",
          }}
        >
          {issues.errors} ⛔
        </span>
      )}
      {issues.warnings > 0 && (
        <span
          title={`${issues.warnings} warning${issues.warnings !== 1 ? "s" : ""}`}
          style={{
            flexShrink: 0, fontSize: "10px", fontWeight: 800, color: "#956f00",
            background: "rgba(255,222,0,0.3)", borderRadius: "100px", padding: "2px 8px",
          }}
        >
          {issues.warnings} ⚠
        </span>
      )}
      {chips.map((c) => (
        <span
          key={c}
          style={{
            flexShrink: 0, fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.55)",
            border: "1px dashed rgba(3,72,82,0.25)", borderRadius: "100px", padding: "1px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {c}
        </span>
      ))}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        style={{
          padding: "5px 12px", borderRadius: "8px",
          border: "1.5px solid rgba(3,72,82,0.15)",
          background: hovered ? "rgba(3,72,82,0.06)" : "transparent",
          color: "#034852", fontSize: "12px", fontWeight: 600,
          cursor: "pointer", flexShrink: 0, transition: "background 120ms ease",
        }}
      >
        Edit
      </button>
    </div>
  );
}

// ── Quiz details card ─────────────────────────────────────────────────────────

function QuizDetailsCard({
  data,
  onChange,
}: {
  data: ParsedBulkQuiz;
  onChange: (data: ParsedBulkQuiz) => void;
}) {
  const set = <K extends keyof ParsedBulkQuiz>(key: K, val: ParsedBulkQuiz[K]) =>
    onChange({ ...data, [key]: val });

  return (
    <div style={S.sectionCard}>
      <div style={S.sectionHeader}>
        <p style={S.sectionTitle}>Quiz Details</p>
      </div>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <span style={S.fieldLabel}>Title *</span>
          <input
            style={S.panelInput}
            value={data.title ?? ""}
            placeholder="Quiz title (required)"
            onChange={(e) => set("title", e.target.value || undefined)}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ flex: "1 1 140px" }}>
            <span style={S.fieldLabel}>Duration (minutes)</span>
            <input
              style={S.panelInput}
              type="number"
              min="0"
              value={data.duration_minutes ?? ""}
              placeholder="—"
              onChange={(e) =>
                set("duration_minutes", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <span style={S.fieldLabel}>Total Marks</span>
            <input
              style={S.panelInput}
              type="number"
              min="0"
              value={data.max_marks ?? ""}
              placeholder="—"
              onChange={(e) =>
                set("max_marks", e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>
        </div>
        <div>
          <span style={S.fieldLabel}>Instructions</span>
          <textarea
            style={S.panelTextarea}
            rows={3}
            value={data.instruction ?? ""}
            placeholder="General instructions for this quiz…"
            onChange={(e) => set("instruction", e.target.value || undefined)}
          />
        </div>
      </div>
    </div>
  );
}

// ── Mock Quiz Generator for Preview ───────────────────────────────────────────

function mockQuizFromParsed(parsed: ParsedBulkQuiz): Quiz {
  let qIdCounter = 1;
  let oIdCounter = 1;
  let sIdCounter = 1;

  const toMockQuestion = (pq: ParsedQuestion): Question => ({
    id: `mock-q-${qIdCounter++}`,
    quiz_id: "mock-quiz",
    question_type: pq.question_type,
    content_html: pq.content,
    correct_answer: pq.correct_answer ?? null,
    tolerance: pq.tolerance ?? null,
    programme_type: null,
    subject: pq.subject ?? null,
    topic: pq.topic ?? null,
    difficulty: pq.difficulty ?? null,
    explanation_video_url: null,
    marks: pq.marks ?? null,
    negative_marks: pq.negative_marks ?? null,
    answer_time_minutes: pq.answer_time_minutes ?? null,
    instruction_html: pq.instruction ?? null,
    evaluation_criteria_json: pq.evaluation_criteria ? pq.evaluation_criteria.map(c => ({ criteria: c.criteria, percentage: c.percentage })) : null,
    tag: pq.tag ?? null,
    solution: pq.solution ?? null,
    image_url: pq.image ?? null,
    created_by: null,
    options: (pq.options || []).map(o => ({
      id: `mock-o-${oIdCounter++}`,
      option_text: o.text,
      is_correct: o.is_correct,
    })),
    children: (pq.children || []).map(toMockQuestion),
  });

  const safeSections = parsed.sections || [];
  const sections: QuizSection[] = safeSections.map((s, idx) => ({
    id: `mock-s-${sIdCounter++}`,
    quiz_id: "mock-quiz",
    title: s.title,
    order_index: idx,
    duration_minutes: s.duration_minutes ?? null,
    pass_threshold_percent: null,
    questions: (s.questions || []).map(toMockQuestion),
  }));

  const isSectioned = safeSections.length > 1 || (safeSections.length === 1 && safeSections[0].title.toLowerCase() !== "default");

  return {
    id: "mock-quiz",
    module_id: null,
    title: parsed.title || "Untitled Quiz",
    description: parsed.instruction || null,
    duration_minutes: parsed.duration_minutes ?? null,
    max_attempts: null,
    pass_threshold_percent: null,
    // Preview-only mock: never deadlined, never archived.
    due_at: null,
    archived_at: null,
    shuffle_questions: false,
    show_answers_after: true,
    quiz_type: "GLOBAL_TEST",
    published: false,
    created_by: null,
    created_at: new Date().toISOString(),
    questions: safeSections.flatMap(s => (s.questions || []).map(toMockQuestion)),
    is_sectioned: isSectioned,
    sequential_sections: false,
    sections,
    first_attempt_counts: true,
    require_fullscreen: false,
    negative_marking: safeSections.some(s => (s.questions || []).some(q => q.negative_marks != null && q.negative_marks > 0)),
    correct_marks: 1,
    wrong_marks: 0,
  };
}

// ── Bulk-fill bar ─────────────────────────────────────────────────────────────

/**
 * Fill a tag for every question that is missing it — the whole upload is
 * usually one subject, so "Set subject for all untagged (12)" is the single
 * most useful fix on this page. Never overwrites a value already present.
 */
function BulkFillBar({
  countMissing,
  fillMissing,
  suggestions,
}: {
  countMissing: (field: "subject" | "topic" | "difficulty") => number;
  fillMissing: (field: "subject" | "topic" | "difficulty", value: string) => void;
  suggestions: { subjects: string[]; topics: Array<{ value: string; subject: string | null }>; tags: string[] };
}) {
  const [field, setField] = useState<"subject" | "topic" | "difficulty">("subject");
  const [value, setValue] = useState("");
  const missing = countMissing(field);
  const listId = "og-bulkfill-list";
  const listValues =
    field === "subject" ? suggestions.subjects : field === "topic" ? suggestions.topics.map((t) => t.value) : [];

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap",
        padding: "10px 16px", borderRadius: "12px",
        border: "1px solid rgba(3,72,82,0.12)", background: "rgba(255,255,255,0.75)",
        fontSize: "12px",
      }}
    >
      <span style={{ fontWeight: 700, color: "#034852" }}>Bulk fill:</span>
      <select
        value={field}
        onChange={(e) => { setField(e.target.value as typeof field); setValue(""); }}
        style={{ ...S.panelInput, width: "auto", padding: "6px 8px", fontSize: "12px" }}
        aria-label="Tag to fill"
      >
        <option value="subject">subject</option>
        <option value="topic">topic</option>
        <option value="difficulty">difficulty</option>
      </select>
      {field === "difficulty" ? (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ ...S.panelInput, width: "auto", padding: "6px 8px", fontSize: "12px" }}
          aria-label="Difficulty value"
        >
          <option value="">choose…</option>
          {QUESTION_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      ) : (
        <>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`e.g. ${field === "subject" ? "Mathematics" : "Algebra"}`}
            list={listId}
            style={{ ...S.panelInput, width: "180px", padding: "6px 8px", fontSize: "12px" }}
            aria-label={`${field} value`}
          />
          <datalist id={listId}>
            {listValues.map((v) => <option key={v} value={v} />)}
          </datalist>
        </>
      )}
      <button
        type="button"
        onClick={() => { fillMissing(field, value); setValue(""); }}
        disabled={!value.trim() || missing === 0}
        style={{
          padding: "6px 14px", borderRadius: "8px", border: "none",
          background: value.trim() && missing > 0 ? "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)" : "rgba(3,72,82,0.15)",
          color: "#fff", fontWeight: 700, fontSize: "12px",
          cursor: value.trim() && missing > 0 ? "pointer" : "default",
        }}
      >
        Set for all untagged ({missing})
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface QuizPreviewEditorProps {
  data: ParsedBulkQuiz;
  onChange: (data: ParsedBulkQuiz) => void;
  /** Called with the still-unresolved syntactic diagnostics (sent to save). */
  onConfirm: (unresolved: ParseDiagnostic[]) => void;
  onBack: () => void;
  /** Diagnostics from the parse result (syntactic + semantic, split here). */
  initialDiagnostics?: ParseDiagnostic[];
  /** When provided, offers a jump back to the source-repair step. */
  onEditSource?: () => void;
  saving: boolean;
  error: string | null;
}

export function QuizPreviewEditor({
  data,
  onChange,
  onConfirm,
  onBack,
  initialDiagnostics,
  onEditSource,
  saving,
  error,
}: QuizPreviewEditorProps) {
  const [activeQ, setActiveQ] = useState<QuestionAddress>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);

  // Two diagnostic buckets — see lib/quiz-import-diagnostics.ts.
  // Syntactic items are resolved explicitly (apply/append/discard/ignore) and
  // never regenerated; semantic items are replaced by every re-validate.
  const [syntactic, setSyntactic] = useState<ParseDiagnostic[]>(
    () => splitDiagnostics(initialDiagnostics ?? []).syntactic.filter((d) => d.severity !== "info"),
  );
  const [semantic, setSemantic] = useState<ParseDiagnostic[]>(
    () => splitDiagnostics(initialDiagnostics ?? []).semantic,
  );
  const [facets, setFacets] = useState<QuestionFacets | null>(null);

  useEffect(() => {
    let stale = false;
    getQuestionFacets()
      .then((f) => { if (!stale) setFacets(f); })
      .catch(() => undefined); // suggestions are a nicety, never a blocker
    return () => { stale = true; };
  }, []);

  // Re-validate on the backend after every edit (debounced). The backend is
  // the only holder of the semantic rule set — nothing is mirrored here.
  const validateSeq = useRef(0);
  useEffect(() => {
    const seq = ++validateSeq.current;
    const timer = setTimeout(() => {
      const { diagnostics: _diags, ...quiz } = data;
      bulkValidateQuiz(quiz)
        .then((list) => { if (validateSeq.current === seq) setSemantic(list); })
        .catch(() => undefined); // keep the previous result on a blip
    }, 400);
    return () => clearTimeout(timer);
  }, [data]);

  const allDiags = useMemo(() => [...syntactic, ...semantic], [syntactic, semantic]);
  const { errors: errorCount, warnings: warningCount } = countBySeverity(
    allDiags.filter((d) => d.severity !== "info"),
  );

  const resolveSyntactic = (diag: ParseDiagnostic, mode: FixMode | "ignore") => {
    if (mode !== "ignore") {
      const next = applyDiagnosticFix(data, diag, mode);
      if (next) onChange(next);
    }
    setSyntactic((prev) => prev.filter((d) => d !== diag));
  };

  // ── Suggestion lists: values already in this upload first, then the bank ──
  const suggestions = useMemo(() => {
    const subjects = new Map<string, string>();
    const topics = new Map<string, { value: string; subject: string | null }>();
    const tags = new Map<string, string>();
    const eat = (q: ParsedQuestion) => {
      if (q.subject?.trim()) subjects.set(q.subject.trim().toLowerCase(), q.subject.trim());
      if (q.topic?.trim()) {
        topics.set(q.topic.trim().toLowerCase(), {
          value: q.topic.trim(), subject: q.subject?.trim() ?? null,
        });
      }
      if (q.tag?.trim()) tags.set(q.tag.trim().toLowerCase(), q.tag.trim());
      q.children?.forEach(eat);
    };
    (data?.sections ?? []).forEach((s) => s.questions?.forEach(eat));
    for (const f of facets?.subjects ?? []) {
      if (!subjects.has(f.value.toLowerCase())) subjects.set(f.value.toLowerCase(), f.value);
    }
    for (const f of facets?.topics ?? []) {
      if (!topics.has(f.value.toLowerCase())) {
        topics.set(f.value.toLowerCase(), { value: f.value, subject: f.subject });
      }
    }
    for (const f of facets?.tags ?? []) {
      if (!tags.has(f.value.toLowerCase())) tags.set(f.value.toLowerCase(), f.value);
    }
    return {
      subjects: [...subjects.values()],
      topics: [...topics.values()],
      tags: [...tags.values()],
    };
  }, [data, facets]);

  // ── Bulk fill ──────────────────────────────────────────────────────────────
  type FillField = "subject" | "topic" | "difficulty";
  const countMissing = (field: FillField): number => {
    let n = 0;
    const visit = (q: ParsedQuestion) => {
      const applies = field !== "difficulty" || q.question_type !== "GROUP";
      if (applies && !(q[field] as string | undefined)?.trim()) n++;
      q.children?.forEach(visit);
    };
    (data?.sections ?? []).forEach((s) => s.questions?.forEach(visit));
    return n;
  };
  const fillMissing = (field: FillField, value: string) => {
    const v = value.trim();
    if (!v) return;
    const fill = (q: ParsedQuestion): ParsedQuestion => {
      const applies = field !== "difficulty" || q.question_type !== "GROUP";
      const next: ParsedQuestion = {
        ...q,
        ...(applies && !(q[field] as string | undefined)?.trim() ? { [field]: v } : {}),
      };
      if (q.children) next.children = q.children.map(fill);
      return next;
    };
    onChange({
      ...data,
      sections: data.sections.map((s) => ({ ...s, questions: s.questions.map(fill) })),
    });
  };

  const [confirming, setConfirming] = useState(false);
  const handleConfirmClick = async () => {
    if (confirming) return;
    // The button gates on the debounced result, but a user can edit and click
    // Save inside the debounce window — so the gate itself runs on a FRESH
    // validation, not the last one that happened to arrive.
    setConfirming(true);
    let freshSemantic: ParseDiagnostic[];
    try {
      const { diagnostics: _diags, ...quiz } = data;
      freshSemantic = await bulkValidateQuiz(quiz);
      setSemantic(freshSemantic);
    } catch {
      // Fail CLOSED: proceeding on a stale result could skip the warning
      // acknowledgement for issues introduced by the latest edit. The server
      // would still block errors, but not warnings — so no validation, no save.
      window.alert("Couldn't re-check the quiz (network problem?). Nothing was saved — try again.");
      setConfirming(false);
      return;
    }
    setConfirming(false);
    const active = [...syntactic, ...freshSemantic].filter((d) => d.severity !== "info");
    const errs = active.filter((d) => d.severity === "error").length;
    const warns = active.filter((d) => d.severity === "warning").length;
    if (errs > 0) return;
    if (warns > 0) {
      const noSubject = active.filter((d) => d.code === "MISSING_SUBJECT").length;
      const lines = [
        `Save with ${warns} warning${warns !== 1 ? "s" : ""}?`,
        noSubject > 0
          ? `\n${noSubject} question${noSubject !== 1 ? "s" : ""} have no subject — they will be EXCLUDED from topic analytics and report cards.`
          : "",
        "\nTags are frozen into each attempt: they cannot be fixed retroactively once students have taken the quiz.",
      ];
      if (!window.confirm(lines.join(""))) return;
    }
    onConfirm(syntactic);
  };

  const safeSections = data?.sections || [];
  const totalQuestions = safeSections.reduce((acc, s) => acc + (s.questions?.length || 0), 0);

  const updateQuestion = (sIdx: number, qIdx: number, q: ParsedQuestion) => {
    const sections = safeSections.map((s, i) => {
      if (i !== sIdx) return s;
      const qs = s.questions || [];
      return { ...s, questions: qs.map((existing, j) => (j === qIdx ? q : existing)) };
    });
    onChange({ ...data, sections });
  };

  const updateSection = (
    sIdx: number,
    patch: Partial<{ title: string; duration_minutes: number | undefined; marks: number | undefined }>,
  ) => {
    const sections = safeSections.map((s, i) => (i === sIdx ? { ...s, ...patch } : s));
    onChange({ ...data, sections });
  };

  const openQuestion = activeQ
    ? safeSections[activeQ.sIdx]?.questions?.[activeQ.qIdx] ?? null
    : null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Summary bar */}
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(10,190,98,0.07)",
            borderRadius: "12px",
            border: "1px solid rgba(10,190,98,0.2)",
            fontSize: "13px",
            color: "#034852",
            fontWeight: 600,
          }}
        >
          Parsed — {safeSections.length} section{safeSections.length !== 1 ? "s" : ""},{" "}
          {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}.{" "}
          <span style={{ fontWeight: 400, opacity: 0.7 }}>
            Review quiz details and click any question to edit, then save.
          </span>
          {onEditSource && (
            <button
              type="button"
              onClick={onEditSource}
              style={{
                marginLeft: "10px", padding: "3px 10px", borderRadius: "8px",
                border: "1.5px solid rgba(3,72,82,0.2)", background: "transparent",
                color: "#034852", fontSize: "12px", fontWeight: 600, cursor: "pointer",
              }}
            >
              ✎ Edit source
            </button>
          )}
        </div>

        {/* Issues card */}
        {(errorCount > 0 || warningCount > 0) && (
          <div
            style={{
              borderRadius: "12px",
              border: `1.5px solid ${errorCount > 0 ? "rgba(229,62,62,0.3)" : "rgba(255,170,0,0.35)"}`,
              background: errorCount > 0 ? "rgba(229,62,62,0.04)" : "rgba(255,222,0,0.05)",
              padding: "12px 16px",
              display: "flex", flexDirection: "column", gap: "8px",
            }}
            role="status"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#034852" }}>
                {errorCount > 0 && <span style={{ color: "#c53030" }}>⛔ {errorCount} error{errorCount !== 1 ? "s" : ""}</span>}
                {errorCount > 0 && warningCount > 0 && " · "}
                {warningCount > 0 && <span style={{ color: "#956f00" }}>⚠️ {warningCount} warning{warningCount !== 1 ? "s" : ""}</span>}
              </span>
              <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
                {errorCount > 0
                  ? "Errors block saving — open the flagged questions to fix them."
                  : "Warnings don't block saving, but untagged questions vanish from analytics."}
              </span>
              <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "#034852", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyIssues}
                  onChange={(e) => setOnlyIssues(e.target.checked)}
                />
                Only questions with issues
              </label>
            </div>
            {/* Every issue, clickable: opens the question; Apply when a one-click fix exists. */}
            <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
              {allDiags
                .filter((d) => d.severity !== "info")
                .map((d, i) => {
                  const w = d.where;
                  const hasQ = typeof w === "object" && "q" in w;
                  const isSyn = syntactic.includes(d);
                  const canApply = d.fix?.field != null && d.fix.value != null;
                  const applyIt = () => {
                    if (isSyn) { resolveSyntactic(d, "apply"); return; }
                    const next = applyDiagnosticFix(data, d, "apply");
                    if (next) onChange(next); // semantic: the next validate clears it
                  };
                  return (
                    <div
                      key={d.id ?? `d${i}`}
                      onClick={() => { if (hasQ) setActiveQ({ sIdx: w.s, qIdx: w.q }); }}
                      style={{
                        display: "flex", alignItems: "center", gap: "8px", fontSize: "12px",
                        color: d.severity === "error" ? "#c53030" : "#956f00", fontWeight: 600,
                        cursor: hasQ ? "pointer" : "default", padding: "3px 4px", borderRadius: "6px",
                      }}
                      title={hasQ ? "Open this question" : undefined}
                    >
                      <span aria-hidden>{d.severity === "error" ? "⛔" : "⚠️"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>{d.message}</span>
                      {canApply && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); applyIt(); }}
                          style={{
                            flexShrink: 0, padding: "3px 10px", borderRadius: "7px", fontSize: "11px", fontWeight: 700,
                            border: "1.5px solid #0abe62", background: "#fff", color: "#0f6b58", cursor: "pointer",
                          }}
                        >
                          ✓ Apply {String(d.fix!.field)} = {String(d.fix!.value)}
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Bulk-fill bar */}
        {(["subject", "topic", "difficulty"] as const).some((f) => countMissing(f) > 0) && (
          <BulkFillBar
            countMissing={countMissing}
            fillMissing={fillMissing}
            suggestions={suggestions}
          />
        )}

        {/* Quiz-level details */}
        <QuizDetailsCard data={data} onChange={onChange} />

        {/* Section cards */}
        {safeSections.map((sec, sIdx) => (
          <div key={sIdx} style={S.sectionCard}>
            <div style={{ ...S.sectionHeader, flexWrap: "wrap", gap: "10px" }}>
              {/* Section title (editable) */}
              <input
                style={{
                  ...S.panelInput,
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "14px",
                  color: "#034852",
                  flex: "1 1 160px",
                  minWidth: 0,
                  background: "transparent",
                  border: "1.5px solid transparent",
                }}
                value={sec.title}
                onFocus={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "rgba(3,72,82,0.25)";
                  (e.target as HTMLInputElement).style.background = "#fff";
                }}
                onBlur={(e) => {
                  (e.target as HTMLInputElement).style.borderColor = "transparent";
                  (e.target as HTMLInputElement).style.background = "transparent";
                }}
                onChange={(e) => updateSection(sIdx, { title: e.target.value })}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", maxWidth: "100%" }}>
                {/* Section duration */}
                <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(3,72,82,0.5)", whiteSpace: "nowrap" }}>
                    min
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={sec.duration_minutes ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateSection(sIdx, {
                        duration_minutes: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    style={{
                      ...S.panelInput,
                      width: "60px",
                      padding: "4px 6px",
                      fontSize: "12px",
                      textAlign: "center",
                    }}
                  />
                </label>

                {/* Section marks */}
                <label style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(3,72,82,0.5)", whiteSpace: "nowrap" }}>
                    marks
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={sec.marks ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateSection(sIdx, {
                        marks: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    style={{
                      ...S.panelInput,
                      width: "60px",
                      padding: "4px 6px",
                      fontSize: "12px",
                      textAlign: "center",
                    }}
                  />
                </label>

                <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>
                  {(sec.questions || []).length} Q
                </span>
                <button
                  type="button"
                  style={{ ...S.secondaryBtn, padding: "4px 12px", fontSize: "12px" }}
                  onClick={() => setCollapsed((c) => ({ ...c, [sIdx]: !c[sIdx] }))}
                >
                  {collapsed[sIdx] ? "Expand" : "Collapse"}
                </button>
              </div>
            </div>

            {!collapsed[sIdx] && (
              <div>
                {(sec.questions || []).map((q, qIdx) => {
                  const rowDiags = diagsForQuestion(allDiags, sIdx, qIdx)
                    .filter((d) => d.severity !== "info");
                  const issues = countBySeverity(rowDiags);
                  if (onlyIssues && issues.errors === 0 && issues.warnings === 0 &&
                      missingTagChips(q).length === 0) {
                    return null;
                  }
                  return (
                    <QuestionRowItem
                      key={qIdx}
                      question={q}
                      index={qIdx}
                      isLast={qIdx === sec.questions.length - 1}
                      onEdit={() => setActiveQ({ sIdx, qIdx })}
                      issues={issues}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Error */}
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

        {/* Action bar */}
        <div style={{ ...S.actionBar, flexWrap: "wrap-reverse" }}>
          <button type="button" style={{ ...S.secondaryBtn, flex: "1 1 120px", textAlign: "center" }} onClick={onBack} disabled={saving}>
            ← Back
          </button>
          <button
            type="button"
            style={{ ...S.secondaryBtn, flex: "1 1 140px", textAlign: "center" }}
            onClick={() => setPreviewOpen(true)}
            disabled={saving}
          >
            Student Preview
          </button>
          <button
            type="button"
            style={{
              ...S.primaryBtn,
              opacity: saving || confirming || errorCount > 0 ? 0.6 : 1,
              flex: "2 1 200px", textAlign: "center", whiteSpace: "normal",
              cursor: saving || confirming || errorCount > 0 ? "default" : "pointer",
            }}
            onClick={() => { void handleConfirmClick(); }}
            disabled={saving || confirming || errorCount > 0}
            title={
              errorCount > 0
                ? `Fix ${errorCount} error${errorCount !== 1 ? "s" : ""} before saving`
                : undefined
            }
          >
            {saving
              ? "Saving…"
              : confirming
                ? "Checking…"
                : errorCount > 0
                  ? `Fix ${errorCount} error${errorCount !== 1 ? "s" : ""} to save`
                  : "Confirm & Save Quiz"}
          </button>
        </div>
      </div>

      {/* Side panel */}
      {activeQ && openQuestion && (
        <QuestionPanel
          question={openQuestion}
          sIdx={activeQ.sIdx}
          qIdx={activeQ.qIdx}
          onClose={() => setActiveQ(null)}
          onChange={(q) => updateQuestion(activeQ.sIdx, activeQ.qIdx, q)}
          diagnostics={diagsForQuestion(syntactic, activeQ.sIdx, activeQ.qIdx)}
          onResolve={resolveSyntactic}
          suggestions={suggestions}
        />
      )}

      {/* Student Preview Modal */}
      {previewOpen && (
        <QuizStudentPreview quiz={mockQuizFromParsed(data)} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  );
}
