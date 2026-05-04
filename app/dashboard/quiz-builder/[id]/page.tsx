"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getQuizById,
  updateQuiz,
  addQuizQuestion,
  addQuizQuestionFromBank,
  reorderQuizQuestions,
  removeQuizQuestion,
  publishQuiz,
  getQuestions,
  type Quiz,
  type Question,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";
import {
  QuestionSlideOver,
  stripHtml,
  typeBadge,
  Tag,
} from "@/app/dashboard/_components/QuestionSlideOver";

const ALLOWED_ROLES: RoleCode[] = ["SUPER_ADMIN", "PROGRAM_MANAGER"];

// ── Page ───────────────────────────────────────────────────────

export default function QuizBuilderPage() {
  const params     = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router     = useRouter();
  const quizId     = params.id;
  const courseId   = searchParams.get("course_id") ?? "";

  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const roleCode = (userData?.role?.code ?? "") as RoleCode;
  const userId   = userData?.user?.id ?? "";

  const [quiz, setQuiz]       = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  // Settings form state
  const [title, setTitle]                 = useState("");
  const [duration, setDuration]           = useState("");
  const [maxAttempts, setMaxAttempts]     = useState("");
  const [passThreshold, setPassThreshold] = useState("");
  const [shuffle, setShuffle]             = useState(false);
  const [showAnswers, setShowAnswers]     = useState(true);
  const [settingsErr, setSettingsErr]     = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Publish
  const [publishing, setPublishing]     = useState(false);
  const [publishErr, setPublishErr]     = useState<string | null>(null);

  // Question panel / bank modal
  const [panelOpen, setPanelOpen]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Question | null>(null);
  const [bankOpen, setBankOpen]         = useState(false);

  // DnD ordering
  const [questions, setQuestions]   = useState<Question[]>([]);
  const dragIdx = useRef<number | null>(null);

  const backHref = courseId ? `/dashboard/courses/${courseId}/builder` : "/dashboard/test-bank";

  const reload = useCallback(async () => {
    try {
      const q = await getQuizById(quizId);
      setQuiz(q);
      setQuestions(q.questions);
      setTitle(q.title);
      setDuration(q.duration_minutes?.toString() ?? "");
      setMaxAttempts(q.max_attempts?.toString() ?? "");
      setPassThreshold(q.pass_threshold_percent?.toString() ?? "");
      setShuffle(q.shuffle_questions);
      setShowAnswers(q.show_answers_after);
    } catch (e) {
      setGlobalErr(e instanceof Error ? e.message : "Failed to load quiz.");
    }
  }, [quizId]);

  useEffect(() => {
    if (!userLoading) {
      setLoading(true);
      reload().finally(() => setLoading(false));
    }
  }, [userLoading, reload]);

  if (userLoading || loading) return <LoadingState />;

  if (!ALLOWED_ROLES.includes(roleCode)) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Access Denied</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Quiz Builder is for Super Admins and Program Managers only.</p>
      </div>
    );
  }

  if (globalErr) {
    return (
      <div style={glassCard}>
        <p style={{ color: "#e53e3e", fontWeight: 600 }}>{globalErr}</p>
        <button onClick={() => router.back()} style={{ ...S.primaryBtn, marginTop: "16px" }}>← Go Back</button>
      </div>
    );
  }

  // ── Settings save ────────────────────────────────────────────

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setSettingsErr("Title is required."); return; }
    setSaving(true);
    setSettingsErr(null);
    setSettingsSaved(false);
    try {
      await updateQuiz(quizId, {
        title:                  title.trim(),
        duration_minutes:       duration      ? Number(duration)      : null,
        max_attempts:           maxAttempts   ? Number(maxAttempts)   : null,
        pass_threshold_percent: passThreshold ? Number(passThreshold) : null,
        shuffle_questions:      shuffle,
        show_answers_after:     showAnswers,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
      await reload();
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Question remove ──────────────────────────────────────────

  async function handleRemove(qId: string, content: string) {
    if (!confirm(`Remove question: "${stripHtml(content).slice(0, 60)}…"?`)) return;
    try {
      await removeQuizQuestion(quizId, qId);
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Remove failed.");
    }
  }

  // ── Publish ──────────────────────────────────────────────────

  async function handlePublish() {
    if (!confirm("Publish this quiz? Students will be able to see and start it.")) return;
    setPublishing(true);
    setPublishErr(null);
    try {
      await publishQuiz(quizId);
      await reload();
    } catch (err) {
      setPublishErr(err instanceof Error ? err.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  }

  // ── DnD reorder ──────────────────────────────────────────────

  function onDragStart(i: number) { dragIdx.current = i; }

  function onDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...questions];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = i;
    setQuestions(next);
  }

  async function onDrop() {
    if (dragIdx.current === null) return;
    dragIdx.current = null;
    try {
      await reorderQuizQuestions(quizId, questions.map(q => q.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reorder failed.");
      await reload();
    }
  }

  const quizType = quiz?.quiz_type ?? "GLOBAL_TEST";

  return (
    <div style={{ position: "relative" }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: "28px" }}>
        <Link href={backHref} style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}>
          ← {courseId ? "Back to Course Builder" : "Back to Question Bank"}
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: "12px" }}>
          <div>
            <p style={S.label}>{quizType === "MODULE_TEST" ? "Module Test" : "Global Test"}</p>
            <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>{quiz?.title ?? "Quiz Builder"}</h1>
            <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Publish control */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            {quiz?.published ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "10px 18px", borderRadius: "10px",
                background: "rgba(10,190,98,0.1)", border: "1.5px solid rgba(10,190,98,0.3)",
                color: "#0abe62", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
              }}>
                ✓ Published
              </span>
            ) : (
              <button
                onClick={() => void handlePublish()}
                disabled={publishing}
                style={{
                  padding: "10px 20px", border: "none", borderRadius: "10px",
                  background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
                  color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
                  fontSize: "13px", cursor: publishing ? "default" : "pointer",
                  boxShadow: "0 6px 14px rgba(10,190,98,0.25)",
                  opacity: publishing ? 0.6 : 1, transition: "all 220ms ease",
                }}
              >
                {publishing ? "Publishing…" : "Publish Quiz"}
              </button>
            )}
            {publishErr && (
              <p style={{ fontSize: "12px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{publishErr}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings card ─────────────────────────────────── */}
      <form onSubmit={(e) => void saveSettings(e)}>
        <div style={{ ...glassCard, marginBottom: "24px" }}>
          <p style={{ ...S.sectionHeader, marginBottom: "16px" }}>Quiz Settings</p>
          <div style={{ display: "grid", gap: "16px" }}>
            <Field label="Title *">
              <input value={title} onChange={e => setTitle(e.target.value)} style={S.input} placeholder="Quiz title" required />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <Field label="Duration (min, 0=untimed)">
                <input type="number" min="0" value={duration} onChange={e => setDuration(e.target.value)} style={S.input} placeholder="0" />
              </Field>
              <Field label="Max Attempts (0=unlimited)">
                <input type="number" min="0" value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} style={S.input} placeholder="0" />
              </Field>
              <Field label="Pass Threshold (%)">
                <input type="number" min="0" max="100" value={passThreshold} onChange={e => setPassThreshold(e.target.value)} style={S.input} placeholder="60" />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Toggle value={shuffle} onChange={setShuffle} label="Shuffle Questions" />
              <Toggle value={showAnswers} onChange={setShowAnswers} label="Show Answers After Submission" />
            </div>
          </div>
          {settingsErr && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: "12px 0 0" }}>{settingsErr}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
            <button type="submit" disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save Settings"}
            </button>
            {settingsSaved && <span style={{ fontSize: "13px", color: "#0abe62", fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      </form>

      {/* ── Questions card ────────────────────────────────── */}
      <div style={glassCard}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <p style={S.sectionHeader}>Questions ({questions.length})</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setBankOpen(true)} style={S.outlineBtn}>+ Add from Bank</button>
            <button onClick={() => { setEditTarget(null); setPanelOpen(true); }} style={S.primaryBtn}>+ Add Question</button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>
            No questions yet — add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
            {questions.map((q, i) => (
              <QuizQuestionRow
                key={q.id}
                question={q}
                index={i}
                isLast={i === questions.length - 1}
                onDragStart={() => onDragStart(i)}
                onDragOver={e => onDragOver(e, i)}
                onDrop={() => void onDrop()}
                onEdit={() => { setEditTarget(q); setPanelOpen(true); }}
                onRemove={() => void handleRemove(q.id, q.content_html)}
              />
            ))}
          </div>
        )}
        <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.35)", marginTop: "12px", textAlign: "center" }}>
          Drag the ⠿ handle to reorder questions
        </p>
      </div>

      {/* ── Question slide-over ───────────────────────────── */}
      {panelOpen && (
        <QuestionSlideOver
          initial={editTarget}
          createdBy={userId}
          quizId={quizId}
          onClose={() => { setPanelOpen(false); setEditTarget(null); }}
          onSaved={() => { setPanelOpen(false); setEditTarget(null); void reload(); }}
        />
      )}

      {/* ── Bank picker modal ─────────────────────────────── */}
      {bankOpen && (
        <BankPickerModal
          quizId={quizId}
          onClose={() => setBankOpen(false)}
          onPicked={() => { setBankOpen(false); void reload(); }}
        />
      )}
    </div>
  );
}

// ── Question Row (draggable) ───────────────────────────────────

function QuizQuestionRow({
  question, index, isLast,
  onDragStart, onDragOver, onDrop, onEdit, onRemove,
}: {
  question: Question;
  index: number;
  isLast: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: "flex", alignItems: "flex-start", gap: "12px",
        padding: "14px 8px",
        borderBottom: isLast ? "none" : "1px solid rgba(3,72,82,0.06)",
        cursor: "grab",
      }}
    >
      {/* Index + drag handle */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flexShrink: 0, paddingTop: "2px" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(3,72,82,0.3)", lineHeight: 1 }}>{index + 1}</span>
        <span style={{ fontSize: "14px", color: "rgba(3,72,82,0.25)", lineHeight: 1 }}>⠿</span>
      </div>

      {/* Badge */}
      <span style={{ ...typeBadge(question.question_type), flexShrink: 0, marginTop: "2px" }}>
        {question.question_type}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852", lineHeight: 1.4 }}>
          {stripHtml(question.content_html).slice(0, 100)}{stripHtml(question.content_html).length > 100 ? "…" : ""}
        </p>
        <div style={{ display: "flex", gap: "6px", marginTop: "5px", flexWrap: "wrap" }}>
          {question.programme_type && <Tag>{question.programme_type}</Tag>}
          {question.subject && <Tag>{question.subject}</Tag>}
          {question.difficulty && <Tag variant={question.difficulty}>{question.difficulty}</Tag>}
          {question.question_type === "MCQ" && <Tag>{question.options.length} options</Tag>}
          {question.question_type === "GROUP" && <Tag>{question.children.length} sub-qs</Tag>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button style={S.outlineBtn} onClick={onEdit}>Edit</button>
        <button style={{ ...S.outlineBtn, borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }} onClick={onRemove}>Remove</button>
      </div>
    </div>
  );
}

// ── Bank Picker Modal ──────────────────────────────────────────

function BankPickerModal({ quizId, onClose, onPicked }: { quizId: string; onClose: () => void; onPicked: () => void }) {
  const [bankQs, setBankQs]             = useState<Question[]>([]);
  const [loadingBank, setLoadingBank]   = useState(true);
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [copying, setCopying]           = useState(false);
  const [err, setErr]                   = useState<string | null>(null);

  useEffect(() => {
    setLoadingBank(true);
    getQuestions({ bank: true })
      .then(setBankQs)
      .catch(() => setBankQs([]))
      .finally(() => setLoadingBank(false));
  }, []);

  const filtered = bankQs.filter(q =>
    stripHtml(q.content_html).toLowerCase().includes(search.toLowerCase()) ||
    (q.subject ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (q.topic ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleCopy() {
    if (selected.size === 0) return;
    setCopying(true);
    setErr(null);
    try {
      for (const qId of selected) {
        await addQuizQuestionFromBank(quizId, qId);
      }
      onPicked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Copy failed.");
      setCopying(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.25)", backdropFilter: "blur(4px)", zIndex: 50 }} />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(560px, 94vw)", maxHeight: "80vh",
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: "24px", padding: "28px",
        boxShadow: "0 32px 64px rgba(0,0,0,0.18)",
        zIndex: 51, display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <p style={S.label}>Add from Bank</p>
            <h3 style={{ ...S.heading, fontSize: "18px", margin: "4px 0 0" }}>
              Select questions {selected.size > 0 && `(${selected.size} selected)`}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", color: "rgba(3,72,82,0.4)", cursor: "pointer" }}>✕</button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by content, subject, or topic…"
          style={{ ...S.input, marginBottom: "12px", flexShrink: 0 }}
        />

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "14px", minHeight: 0 }}>
          {loadingBank ? (
            <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>Loading bank…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "20px", textAlign: "center", color: "rgba(3,72,82,0.5)", fontSize: "13px" }}>
              {search ? "No questions match." : "Bank is empty."}
            </p>
          ) : filtered.map((q, i) => {
            const checked = selected.has(q.id);
            return (
              <div
                key={q.id}
                onClick={() => setSelected(s => { const n = new Set(s); checked ? n.delete(q.id) : n.add(q.id); return n; })}
                style={{
                  display: "flex", gap: "12px", alignItems: "flex-start",
                  padding: "12px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(3,72,82,0.05)" : "none",
                  background: checked ? "rgba(10,190,98,0.07)" : "transparent",
                  borderLeft: checked ? "3px solid #0abe62" : "3px solid transparent",
                  cursor: "pointer", transition: "all 150ms ease",
                }}
              >
                <input type="checkbox" checked={checked} readOnly style={{ marginTop: "3px", accentColor: "#0abe62", flexShrink: 0 }} />
                <span style={{ ...typeBadge(q.question_type), flexShrink: 0, marginTop: "1px" }}>{q.question_type}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852", lineHeight: 1.4 }}>
                    {stripHtml(q.content_html).slice(0, 90)}{stripHtml(q.content_html).length > 90 ? "…" : ""}
                  </p>
                  <div style={{ display: "flex", gap: "5px", marginTop: "4px", flexWrap: "wrap" }}>
                    {q.programme_type && <Tag>{q.programme_type}</Tag>}
                    {q.subject && <Tag>{q.subject}</Tag>}
                    {q.difficulty && <Tag variant={q.difficulty}>{q.difficulty}</Tag>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {err && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: "10px 0 0" }}>{err}</p>}

        {/* Footer */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexShrink: 0 }}>
          <button onClick={onClose} style={{ ...S.primaryBtn, flex: 1, background: "rgba(3,72,82,0.07)", color: "#034852", boxShadow: "none" }}>Cancel</button>
          <button
            onClick={() => void handleCopy()}
            disabled={selected.size === 0 || copying}
            style={{ ...S.primaryBtn, flex: 2, opacity: selected.size === 0 || copying ? 0.5 : 1 }}
          >
            {copying ? "Copying…" : `Copy ${selected.size > 0 ? selected.size + " " : ""}Question${selected.size !== 1 ? "s" : ""} to Quiz`}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Small components ───────────────────────────────────────────

function Field({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)" }}>{lbl}</p>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label: lbl }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(3,72,82,0.03)", borderRadius: "10px", border: "1px solid rgba(3,72,82,0.07)" }}>
      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{lbl}</p>
      <button type="button" onClick={() => onChange(!value)} style={{ width: "40px", height: "22px", borderRadius: "11px", border: "none", cursor: "pointer", background: value ? "#0abe62" : "rgba(3,72,82,0.15)", position: "relative", transition: "background 200ms ease", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: "2px", left: value ? "20px" : "2px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 200ms ease", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching quiz…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)", backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "24px", padding: "28px 32px", boxShadow: "0 32px 64px rgba(0,0,0,0.08)",
};

const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379", margin: 0,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852",
  } as React.CSSProperties,
  sectionHeader: {
    fontFamily: "var(--font-heading)", fontSize: "15px", fontWeight: 700,
    color: "#034852", margin: 0,
  } as React.CSSProperties,
  primaryBtn: {
    padding: "10px 20px", border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
    fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 12px rgba(10,190,98,0.2)",
    transition: "all 220ms ease", whiteSpace: "nowrap",
  } as React.CSSProperties,
  outlineBtn: {
    padding: "7px 14px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px",
    background: "transparent", color: "#034852", fontFamily: "var(--font-body)",
    fontWeight: 600, fontSize: "12px", cursor: "pointer",
  } as React.CSSProperties,
  input: {
    width: "100%", padding: "10px 14px", background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.12)", borderRadius: "10px", color: "#034852",
    fontFamily: "var(--font-body)", fontSize: "14px",
    outline: "none", boxSizing: "border-box",
  } as React.CSSProperties,
};
