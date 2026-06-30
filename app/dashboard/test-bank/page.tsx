"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getQuestions, deleteQuestion, deleteQuestions, getQuizzes, deleteQuiz, type Question, type Quiz } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import {
  QuestionSlideOver,
  QUESTION_TYPES,
  DIFFICULTIES,
  stripHtml,
  typeBadge,
  Tag,
} from "@/app/dashboard/_components/QuestionSlideOver";
import { MathSnippet } from "@/app/dashboard/_components/MathContent";
import { QuestionBulkUploadPanel } from "./QuestionBulkUploadPanel";

// ── Page ───────────────────────────────────────────────────────
// Access (`test_bank.view`) is enforced by the backend and the dashboard
// route guard.

export default function TestBankPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const userId = data?.user?.id ?? "";
  const invalidate = useInvalidate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType]       = useState("");
  const [filterProg, setFilterProg]       = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTopic, setFilterTopic]     = useState("");
  const [filterDiff, setFilterDiff]       = useState("");
  const [filterTag, setFilterTag]         = useState("");

  const [panelOpen, setPanelOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Question | null>(null);
  const [bulkOpen, setBulkOpen]       = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Created Global/Program tests — entry point to re-open them in the builder.
  const [globalTests, setGlobalTests] = useState<Omit<Quiz, "questions">[]>([]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQuestions(await getQuestions({
        question_type:   filterType    || undefined,
        programme_type:  filterProg    || undefined,
        subject:         filterSubject || undefined,
        topic:           filterTopic   || undefined,
        difficulty:      filterDiff    || undefined,
        tag:             filterTag     || undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterProg, filterSubject, filterTopic, filterDiff, filterTag]);

  useEffect(() => {
    if (!userLoading) void fetchQuestions();
  }, [userLoading, fetchQuestions]);

  const fetchGlobalTests = useCallback(async () => {
    try {
      setGlobalTests(await getQuizzes({ quiz_type: "GLOBAL_TEST" }));
    } catch {
      setGlobalTests([]);
    }
  }, []);

  useEffect(() => {
    if (!userLoading) void fetchGlobalTests();
  }, [userLoading, fetchGlobalTests]);

  if (userLoading) return <LoadingState />;

  function openAdd()  { setEditTarget(null); setPanelOpen(true); }
  function openEdit(q: Question) { setEditTarget(q); setPanelOpen(true); }
  function closePanel() { setPanelOpen(false); setEditTarget(null); }

  async function handleDelete(id: string, content: string) {
    if (!confirm(`Delete question: "${stripHtml(content).slice(0, 60)}…"?`)) return;
    try {
      await deleteQuestion(id);
      invalidate('quizzes');
      void fetchQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected question(s)?`)) return;
    try {
      await deleteQuestions(Array.from(selectedIds));
      invalidate('quizzes');
      setSelectedIds(new Set());
      void fetchQuestions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk delete failed.");
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-7">
        <div>
          <p style={labelStyle}>Quizzes</p>
          <h1 style={{ ...headingStyle, fontSize: "28px", margin: 0 }}>Question Bank</h1>
          <p style={{ ...mutedStyle, marginTop: "4px" }}>
            Reusable questions not yet attached to any quiz · {questions.length} question{questions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/dashboard/quiz-builder/new" style={{ ...primaryBtn, background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)", textDecoration: "none" }}>
            + New Global Quiz
          </Link>
          <button style={primaryBtn} onClick={openAdd}>+ Add Question</button>
          <button style={{ ...primaryBtn, background: "linear-gradient(135deg, #006d6c 0%, #034852 100%)" }} onClick={() => setBulkOpen((v) => !v)}>
            ⬆ Upload CSV
          </button>
          <Link href="/dashboard/quiz-builder/bulk-import" style={{ ...primaryBtn, background: "linear-gradient(135deg, #932079 0%, #4a0f3d 100%)", textDecoration: "none" }}>
            ⬆ Bulk Import Quiz
          </Link>
        </div>
      </div>

      {bulkOpen && (
        <QuestionBulkUploadPanel
          createdBy={userId}
          onClose={() => setBulkOpen(false)}
          onDone={() => void fetchQuestions()}
        />
      )}

      {/* ── Program / Global tests ────────────────────────── */}
      {globalTests.length > 0 && (
        <div style={{ ...glassCard, padding: 0, overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(3,72,82,0.06)" }}>
            <p style={labelStyle}>Program Quizzes</p>
            <p style={{ ...mutedStyle, fontSize: "13px", marginTop: "2px" }}>
              {globalTests.length} created · click Edit to manage questions &amp; settings
            </p>
          </div>
          {globalTests.map((t, i) => (
            <GlobalTestRow key={t.id} quiz={t} isLast={i === globalTests.length - 1} onDelete={() => {
              if (confirm(`Delete test: "${t.title}"?`)) {
                deleteQuiz(t.id).then(() => fetchGlobalTests()).catch(e => alert(e.message));
              }
            }} />
          ))}
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────── */}
      <div style={{ ...glassCard, padding: "18px 24px", marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <Sel value={filterType} onChange={setFilterType} placeholder="All Types">
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Sel>
        <Sel value={filterProg} onChange={setFilterProg} placeholder="All Programmes">
          <option value="UG">UG</option>
          <option value="PG">PG</option>
        </Sel>
        <Inp value={filterSubject} onChange={setFilterSubject} placeholder="Subject…" />
        <Inp value={filterTopic}   onChange={setFilterTopic}   placeholder="Topic…" />
        <Inp value={filterTag}     onChange={setFilterTag}     placeholder="Tag…" />
        <Sel value={filterDiff} onChange={setFilterDiff} placeholder="All Difficulties">
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </Sel>
        {(filterType || filterProg || filterSubject || filterTopic || filterDiff || filterTag) && (
          <button onClick={() => { setFilterType(""); setFilterProg(""); setFilterSubject(""); setFilterTopic(""); setFilterDiff(""); setFilterTag(""); }} style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, color: "#e53e3e", cursor: "pointer" }}>
            Clear
          </button>
        )}
        
        {selectedIds.size > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.6)" }}>
              {selectedIds.size} selected
            </span>
            <button onClick={handleBulkDelete} style={{ ...outlineBtn, borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }}>
              Delete Selected
            </button>
          </div>
        )}
      </div>

      {/* ── Question list ─────────────────────────────────── */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
        </div>
      ) : questions.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={labelStyle}>Empty Bank</p>
          <p style={{ ...headingStyle, fontSize: "18px", marginTop: "12px" }}>No questions yet</p>
          <p style={{ ...mutedStyle, marginTop: "8px" }}>Click &quot;+ Add Question&quot; to create the first one.</p>
        </div>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              question={q}
              isLast={i === questions.length - 1}
              selected={selectedIds.has(q.id)}
              onToggleSelect={() => {
                const next = new Set(selectedIds);
                if (next.has(q.id)) next.delete(q.id);
                else next.add(q.id);
                setSelectedIds(next);
              }}
              onEdit={() => openEdit(q)}
              onDelete={() => void handleDelete(q.id, q.content_html)}
            />
          ))}
        </div>
      )}

      {/* ── Slide-over ────────────────────────────────────── */}
      {panelOpen && (
        <QuestionSlideOver
          initial={editTarget}
          createdBy={userId}
          onClose={closePanel}
          onSaved={() => { closePanel(); void fetchQuestions(); }}
        />
      )}
    </div>
  );
}

// ── Global Test Row ────────────────────────────────────────────

function GlobalTestRow({ quiz, isLast, onDelete }: { quiz: Omit<Quiz, "questions">; isLast: boolean; onDelete: () => void }) {
  const created = new Date(quiz.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3.5 px-6 py-4"
      style={{ borderBottom: isLast ? "none" : "1px solid rgba(3,72,82,0.06)" }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", lineHeight: 1.4 }}>{quiz.title}</p>
        <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px",
            background: quiz.published ? "rgba(10,190,98,0.1)" : "rgba(3,72,82,0.06)",
            color: quiz.published ? "#0abe62" : "rgba(3,72,82,0.55)",
          }}>
            {quiz.published ? "Published" : "Draft"}
          </span>
          {quiz.duration_minutes != null && <Tag>{quiz.duration_minutes} min</Tag>}
          <Tag>Created {created}</Tag>
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0 self-start sm:self-auto">
        <Link href={`/dashboard/quiz-builder/${quiz.id}`} style={{ ...outlineBtn, textDecoration: "none", display: "inline-block" }}>
          Edit →
        </Link>
        <button onClick={onDelete} style={{ ...outlineBtn, color: "#e53e3e", borderColor: "rgba(229,62,62,0.2)" }}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Question Row ───────────────────────────────────────────────

function QuestionRow({ question, isLast, selected, onToggleSelect, onEdit, onDelete }: { question: Question; isLast: boolean; selected: boolean; onToggleSelect: () => void; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = question.question_type === "GROUP" && question.children.length > 0;

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid rgba(3,72,82,0.06)", background: selected ? "rgba(3,72,82,0.02)" : "transparent" }}>
      <div
        className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3.5 px-6 py-4"
        style={{ cursor: hasChildren ? "pointer" : "default" }}
        onClick={() => hasChildren && setExpanded(e => !e)}
      >
        <div style={{ paddingTop: "2px", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={selected} 
            onChange={onToggleSelect} 
            style={{ width: "16px", height: "16px", accentColor: "#006d6c", cursor: "pointer" }}
          />
        </div>
        <span style={{ ...typeBadge(question.question_type), flexShrink: 0, marginTop: "2px" }}>{question.question_type}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MathSnippet html={question.content_html} lines={2} style={{ fontSize: "14px", fontWeight: 600, color: "#034852", lineHeight: 1.4 }} />
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            {question.programme_type && <Tag>{question.programme_type}</Tag>}
            {question.subject && <Tag>{question.subject}</Tag>}
            {question.topic && <Tag>{question.topic}</Tag>}
            {question.difficulty && <Tag variant={question.difficulty}>{question.difficulty}</Tag>}
            {question.question_type === "MCQ" && <Tag>{question.options.length} options</Tag>}
            {hasChildren && <Tag>{question.children.length} sub-questions {expanded ? "▲" : "▼"}</Tag>}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0 self-start sm:self-auto" onClick={e => e.stopPropagation()}>
          <button style={outlineBtn} onClick={onEdit}>Edit</button>
          <button style={{ ...outlineBtn, borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }} onClick={onDelete}>Delete</button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div style={{ background: "rgba(3,72,82,0.02)", borderTop: "1px solid rgba(3,72,82,0.06)" }}>
          {question.children.map((child, ci) => (
            <div key={child.id} style={{ display: "flex", gap: "12px", padding: "10px 24px 10px 48px", borderBottom: ci < question.children.length - 1 ? "1px solid rgba(3,72,82,0.04)" : "none" }}>
              <span style={{ ...typeBadge(child.question_type), fontSize: "9px", flexShrink: 0, marginTop: "2px" }}>{child.question_type}</span>
              <MathSnippet html={child.content_html} lines={2} style={{ fontSize: "13px", color: "rgba(3,72,82,0.75)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Utility components ─────────────────────────────────────────

function Sel({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: "140px" }}>
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, width: "130px" }} />;
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={labelStyle}>Loading</p>
        <p style={{ ...headingStyle, marginTop: "12px" }}>Fetching question bank…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
};
const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0,
};
const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
};
const mutedStyle: React.CSSProperties = { fontSize: "14px", color: "rgba(3,72,82,0.6)" };
const primaryBtn: React.CSSProperties = {
  padding: "11px 22px", border: "none", borderRadius: "12px",
  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
  color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700,
  fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
  transition: "all 240ms ease", whiteSpace: "nowrap", display: "inline-block",
};
const outlineBtn: React.CSSProperties = {
  padding: "6px 14px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px",
  background: "transparent", color: "#034852", fontFamily: "var(--font-body)",
  fontWeight: 600, fontSize: "12px", cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box",
};
