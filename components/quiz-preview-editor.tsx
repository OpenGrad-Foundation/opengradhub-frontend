"use client";

import { useEffect, useState } from "react";
import type { ParsedBulkQuiz, ParsedQuestion, ParsedOption } from "@/lib/api";

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
      {options.map((opt, idx) => (
        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
      ))}
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
        <div>
          <span style={S.fieldLabel}>Instruction / Passage</span>
          <textarea
            style={S.panelTextarea}
            value={question.instruction ?? ""}
            onChange={(e) => set("instruction", e.target.value || undefined)}
            rows={3}
          />
        </div>
      )}

      <div>
        <span style={S.fieldLabel}>Question</span>
        <textarea
          style={S.panelTextarea}
          value={question.content}
          onChange={(e) => set("content", e.target.value)}
          rows={4}
        />
      </div>

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
        {(["subject", "topic", "tag", "difficulty"] as const).map((field) => (
          <div key={field}>
            <span style={S.fieldLabel}>{field}</span>
            <input
              style={S.panelInput}
              value={(question[field] as string | undefined) ?? ""}
              placeholder="—"
              onChange={(e) => set(field, e.target.value || undefined)}
            />
          </div>
        ))}
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

      <div>
        <span style={S.fieldLabel}>Image URL (optional)</span>
        <input
          style={S.panelInput}
          value={question.image ?? ""}
          placeholder="https://..."
          type="url"
          onChange={(e) => set("image", e.target.value || undefined)}
        />
      </div>

      <div>
        <span style={S.fieldLabel}>Solution (optional)</span>
        <textarea
          style={S.panelTextarea}
          value={question.solution ?? ""}
          rows={3}
          placeholder="Explanation shown after submission..."
          onChange={(e) => set("solution", e.target.value || undefined)}
        />
      </div>
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
}: {
  question: ParsedQuestion;
  sIdx: number;
  qIdx: number;
  onClose: () => void;
  onChange: (q: ParsedQuestion) => void;
}) {
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
          <QuestionEditorForm question={question} onChange={onChange} />
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

// ── Compact question row ──────────────────────────────────────────────────────

function QuestionRowItem({
  question,
  index,
  isLast,
  onEdit,
}: {
  question: ParsedQuestion;
  index: number;
  isLast: boolean;
  onEdit: () => void;
}) {
  const [hovered, setHovered] = useState(false);

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
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
          <div>
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

// ── Main Component ────────────────────────────────────────────────────────────

export interface QuizPreviewEditorProps {
  data: ParsedBulkQuiz;
  onChange: (data: ParsedBulkQuiz) => void;
  onConfirm: () => void;
  onBack: () => void;
  saving: boolean;
  error: string | null;
}

export function QuizPreviewEditor({
  data,
  onChange,
  onConfirm,
  onBack,
  saving,
  error,
}: QuizPreviewEditorProps) {
  const [activeQ, setActiveQ] = useState<QuestionAddress>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const totalQuestions = data.sections.reduce((acc, s) => acc + s.questions.length, 0);

  const updateQuestion = (sIdx: number, qIdx: number, q: ParsedQuestion) => {
    const sections = data.sections.map((s, i) => {
      if (i !== sIdx) return s;
      return { ...s, questions: s.questions.map((existing, j) => (j === qIdx ? q : existing)) };
    });
    onChange({ ...data, sections });
  };

  const updateSection = (
    sIdx: number,
    patch: Partial<{ title: string; duration_minutes: number | undefined; marks: number | undefined }>,
  ) => {
    const sections = data.sections.map((s, i) => (i === sIdx ? { ...s, ...patch } : s));
    onChange({ ...data, sections });
  };

  const openQuestion = activeQ
    ? data.sections[activeQ.sIdx]?.questions[activeQ.qIdx] ?? null
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
          Parsed successfully — {data.sections.length} section{data.sections.length !== 1 ? "s" : ""},{" "}
          {totalQuestions} question{totalQuestions !== 1 ? "s" : ""}.{" "}
          <span style={{ fontWeight: 400, opacity: 0.7 }}>
            Review quiz details and click any question to edit, then save.
          </span>
        </div>

        {/* Quiz-level details */}
        <QuizDetailsCard data={data} onChange={onChange} />

        {/* Section cards */}
        {data.sections.map((sec, sIdx) => (
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

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
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
                  {sec.questions.length} Q
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
                {sec.questions.map((q, qIdx) => (
                  <QuestionRowItem
                    key={qIdx}
                    question={q}
                    index={qIdx}
                    isLast={qIdx === sec.questions.length - 1}
                    onEdit={() => setActiveQ({ sIdx, qIdx })}
                  />
                ))}
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
        <div style={S.actionBar}>
          <button type="button" style={S.secondaryBtn} onClick={onBack} disabled={saving}>
            ← Back
          </button>
          <button
            type="button"
            style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1 }}
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? "Saving…" : "Confirm & Save Quiz"}
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
        />
      )}
    </>
  );
}
