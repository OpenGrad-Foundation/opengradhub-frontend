"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getQuizById,
  updateQuiz,
  attachQuizQuestion,
  reorderQuizQuestions,
  removeQuizQuestion,
  publishQuiz,
  getQuestions,
  createQuizSection,
  updateQuizSection,
  deleteQuizSection,
  attachQuestionToSection,
  removeQuestionFromSection,
  type Quiz,
  type Question,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInvalidate } from "@/lib/mutations/invalidation";
import {
  QuestionSlideOver,
  stripHtml,
  typeBadge,
  Tag,
} from "@/app/dashboard/_components/QuestionSlideOver";

// ── Page ───────────────────────────────────────────────────────

export default function QuizBuilderPage() {
  const params     = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router     = useRouter();
  const quizId     = params.id;
  const courseId   = searchParams.get("course_id") ?? "";

  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();
  const invalidate = useInvalidate();
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
  const [isSectioned, setIsSectioned]     = useState(false);
  const [sequentialSections, setSequentialSections] = useState(false);
  const [firstAttemptCounts, setFirstAttemptCounts] = useState(false);
  const [requireFullscreen, setRequireFullscreen]   = useState(false);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [correctMarks, setCorrectMarks]       = useState("1");
  const [wrongMarks, setWrongMarks]           = useState("0");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
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
      setIsSectioned(q.is_sectioned);
      setSequentialSections(q.sequential_sections);
      setFirstAttemptCounts(q.first_attempt_counts);
      setRequireFullscreen(q.require_fullscreen);
      setNegativeMarking(q.negative_marking);
      setCorrectMarks(String(q.correct_marks ?? 1));
      setWrongMarks(String(q.wrong_marks ?? 0));
      if (q.is_sectioned && q.sections.length > 0) {
        setActiveSectionId(prev => prev ?? q.sections[0].id);
      }
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

  if (userLoading || loading || permLoading) return <LoadingState />;

  if (!has(PERM.test_bank.edit)) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Access Denied</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>You don&apos;t have permission to edit quizzes.</p>
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
        is_sectioned:           isSectioned,
        sequential_sections:    sequentialSections,
        first_attempt_counts:   firstAttemptCounts,
        require_fullscreen:     requireFullscreen,
        negative_marking:       negativeMarking,
        correct_marks:          correctMarks ? Number(correctMarks) : 1,
        wrong_marks:            negativeMarking ? (wrongMarks ? Number(wrongMarks) : 0) : 0,
      });
      invalidate('quizzes');
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
      invalidate('quizzes');
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Remove failed.");
    }
  }

  // ── Publish ──────────────────────────────────────────────────

  async function handlePublish() {
    if (!confirm("Publish this quiz? Students will be able to see and start it.")) return;

    // Sectioned quiz validation
    if (isSectioned) {
      if (!quiz?.sections || quiz.sections.length === 0) {
        setPublishErr("Sectioned quiz must have at least one section.");
        return;
      }
      for (const s of quiz.sections) {
        if (s.questions.length === 0) {
          setPublishErr(`Section "${s.title}" has no questions.`);
          return;
        }
        if (sequentialSections && s.duration_minutes == null) {
          setPublishErr(`Section "${s.title}" needs a duration (sequential mode).`);
          return;
        }
      }
    }

    setPublishing(true);
    setPublishErr(null);
    try {
      await publishQuiz(quizId);
      invalidate('quizzes');
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
      invalidate('quizzes');
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
        {/* Hard-navigate so the course builder always re-mounts and re-fetches */}
        <a
          href={backHref}
          style={{ fontSize: "13px", color: "#209379", textDecoration: "none", fontWeight: 600 }}
        >
          ← {courseId ? "Back to Course Builder" : "Back to Question Bank"}
        </a>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: "12px" }}>
          <div>
            <p style={S.label}>{quizType === "MODULE_TEST" ? "Module Quiz" : "Global Quiz"}</p>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <Toggle value={isSectioned} onChange={setIsSectioned} label="Section-wise quiz (multiple labeled sections)" />
              {isSectioned && (
                <Toggle value={sequentialSections} onChange={setSequentialSections} label="Sequential — students complete sections in order; each section has its own timer; no going back." />
              )}
              <Toggle value={firstAttemptCounts} onChange={setFirstAttemptCounts} label="First attempt counts (subsequent retakes allowed but won't change the grade)" />
              <Toggle value={requireFullscreen} onChange={setRequireFullscreen} label="Require fullscreen during attempt (desktop only — mobile blocked)" />
              <Toggle value={negativeMarking} onChange={setNegativeMarking} label="Negative marking (deduct marks for wrong answers; blanks never penalized)" />
              {negativeMarking && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Marks per correct answer">
                    <input type="text" inputMode="decimal" value={correctMarks} onChange={e => setCorrectMarks(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} style={S.input} placeholder="4" />
                  </Field>
                  <Field label="Penalty per wrong answer">
                    <input type="text" inputMode="decimal" value={wrongMarks} onChange={e => setWrongMarks(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} style={S.input} placeholder="1" />
                  </Field>
                </div>
              )}
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
        {quiz?.is_sectioned ? (
          <SectionsView
            quiz={quiz}
            activeSectionId={activeSectionId}
            setActiveSectionId={setActiveSectionId}
            sequential={quiz.sequential_sections}
            onReload={reload}
            setBankOpen={setBankOpen}
            setEditTarget={setEditTarget}
            setPanelOpen={setPanelOpen}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* ── Question slide-over ───────────────────────────── */}
      {panelOpen && (
        <QuestionSlideOver
          initial={editTarget}
          createdBy={userId}
          quizId={quiz?.is_sectioned ? undefined : quizId}
          onClose={() => { setPanelOpen(false); setEditTarget(null); }}
          onSaved={() => { setPanelOpen(false); setEditTarget(null); void reload(); }}
          onCreated={quiz?.is_sectioned && activeSectionId ? async (q) => {
            try {
              await attachQuestionToSection(quizId, activeSectionId, q.id);
            } catch (err) {
              alert(err instanceof Error ? err.message : "Failed to attach to section.");
            }
          } : undefined}
        />
      )}

      {/* ── Bank picker modal ─────────────────────────────── */}
      {bankOpen && (
        <BankPickerModal
          quizId={quizId}
          sectionId={quiz?.is_sectioned ? activeSectionId ?? undefined : undefined}
          onClose={() => setBankOpen(false)}
          onPicked={() => { setBankOpen(false); void reload(); }}
        />
      )}
    </div>
  );
}

// ── Section Settings Form (keyed by section id, so state resets on tab switch) ──

function SectionSettingsForm({
  quizId,
  section,
  sequential,
  onReload,
  onDelete,
}: {
  quizId: string;
  section: { id: string; title: string; duration_minutes: number | null; pass_threshold_percent: number | null };
  sequential: boolean;
  onReload: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editTitle, setEditTitle]       = useState(section.title);
  const [editDuration, setEditDuration] = useState(section.duration_minutes?.toString() ?? "");
  const [editThreshold, setEditThreshold] = useState(section.pass_threshold_percent?.toString() ?? "");
  const [saving, setSaving]             = useState(false);
  const invalidate = useInvalidate();

  async function handleSave() {
    setSaving(true);
    try {
      await updateQuizSection(quizId, section.id, {
        title: editTitle.trim() || undefined,
        duration_minutes: editDuration ? Number(editDuration) : null,
        pass_threshold_percent: editThreshold ? Number(editThreshold) : null,
      });
      invalidate('quizzes');
      await onReload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "rgba(3,72,82,0.03)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: sequential ? "2fr 1fr 1fr auto auto" : "2fr 1fr auto auto", gap: "12px", alignItems: "end" }}>
        <label>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.7)", display: "block", marginBottom: "4px" }}>Title</span>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid rgba(3,72,82,0.15)", boxSizing: "border-box" }}
          />
        </label>
        {sequential && (
          <label>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.7)", display: "block", marginBottom: "4px" }}>Duration (min)</span>
            <input
              type="number"
              value={editDuration}
              onChange={(e) => setEditDuration(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid rgba(3,72,82,0.15)", boxSizing: "border-box" }}
            />
          </label>
        )}
        <label>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.7)", display: "block", marginBottom: "4px" }}>Pass %</span>
          <input
            type="number"
            value={editThreshold}
            onChange={(e) => setEditThreshold(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid rgba(3,72,82,0.15)", boxSizing: "border-box" }}
          />
        </label>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#209379", color: "#fff", fontWeight: 600, cursor: saving ? "default" : "pointer" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => void onDelete()}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #e53e3e", background: "transparent", color: "#e53e3e", fontWeight: 600, cursor: "pointer" }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Sections View ─────────────────────────────────────────────

function SectionsView({
  quiz,
  activeSectionId,
  setActiveSectionId,
  sequential,
  onReload,
  setBankOpen,
  setEditTarget,
  setPanelOpen,
}: {
  quiz: Quiz;
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
  sequential: boolean;
  onReload: () => Promise<void>;
  setBankOpen: (open: boolean) => void;
  setEditTarget: (q: Question | null) => void;
  setPanelOpen: (open: boolean) => void;
}) {
  const sections = quiz.sections;
  const active = sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? null;

  const invalidate = useInvalidate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);

  function handleAddSection() {
    setNewSectionTitle("");
    setAddError(null);
    setShowAddModal(true);
  }

  async function submitAddSection() {
    const title = newSectionTitle.trim();
    if (!title) {
      setAddError("Section title is required.");
      return;
    }
    setAddingSection(true);
    setAddError(null);
    try {
      const created = await createQuizSection(quiz.id, { title });
      invalidate('quizzes');
      await onReload();
      setActiveSectionId(created.id);
      setShowAddModal(false);
      setNewSectionTitle("");
    } catch (err) {
      setAddError(
        err instanceof Error
          ? err.message
          : "Couldn't add section. Make sure 'Section-wise quiz' is enabled in settings and saved first.",
      );
    } finally {
      setAddingSection(false);
    }
  }

  async function handleDeleteSection() {
    if (!active) return;
    if (!window.confirm(`Delete section "${active.title}"? Its questions stay in the bank but the section + its question links are removed.`)) return;
    await deleteQuizSection(quiz.id, active.id);
    invalidate('quizzes');
    setActiveSectionId(null);
    await onReload();
  }

  async function handleRemoveQuestion(questionId: string) {
    if (!active) return;
    await removeQuestionFromSection(quiz.id, active.id, questionId);
    invalidate('quizzes');
    await onReload();
  }

  const activeQuestions = active?.questions ?? [];

  return (
    <div>
      {/* Tab strip */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "2px solid rgba(3,72,82,0.08)", marginBottom: "20px", flexWrap: "wrap" }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSectionId(s.id)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: s.id === active?.id ? "#fff" : "transparent",
              borderBottom: s.id === active?.id ? "2px solid #209379" : "2px solid transparent",
              marginBottom: "-2px",
              fontWeight: 600,
              color: "#034852",
              cursor: "pointer",
            }}
          >
            {s.title} ({s.questions.length})
          </button>
        ))}
        {quiz.is_sectioned ? (
          <button
            onClick={handleAddSection}
            style={{ padding: "10px 16px", border: "1px dashed #209379", background: "transparent", color: "#209379", fontWeight: 600, cursor: "pointer", borderRadius: "6px" }}
          >
            + Add Section
          </button>
        ) : (
          <span style={{ padding: "10px 16px", fontSize: "13px", color: "rgba(3,72,82,0.5)", fontStyle: "italic", alignSelf: "center" }}>
            Save settings with Section-wise quiz enabled first
          </span>
        )}
      </div>

      {!active ? (
        <p style={{ color: "rgba(3,72,82,0.6)", fontStyle: "italic" }}>No sections yet. Click + Add Section to create one.</p>
      ) : (
        <>
          {/* Section settings form — keyed by section id so state resets on tab switch */}
          <SectionSettingsForm
            key={active.id}
            quizId={quiz.id}
            section={active}
            sequential={sequential}
            onReload={onReload}
            onDelete={handleDeleteSection}
          />

          {/* Section questions list */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#034852" }}>Questions in this section ({activeQuestions.length})</h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => { setEditTarget(null); setPanelOpen(true); }}
                style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #209379", background: "#fff", color: "#209379", fontWeight: 600, cursor: "pointer" }}
              >
                + New Question
              </button>
              <button
                onClick={() => setBankOpen(true)}
                style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #209379", background: "#209379", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Attach From Bank
              </button>
            </div>
          </div>

          {activeQuestions.length === 0 ? (
            <p style={{ color: "rgba(3,72,82,0.6)", fontStyle: "italic" }}>No questions in this section yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeQuestions.map((q, idx) => (
                <div key={q.id} style={{ padding: "12px 16px", background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "8px", display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ minWidth: "32px", fontWeight: 700, color: "rgba(3,72,82,0.5)" }}>{idx + 1}.</span>
                  <span style={{ flex: 1 }}>{stripHtml(q.content_html).slice(0, 120)}</span>
                  <span style={{ ...typeBadge(q.question_type), flexShrink: 0 }}>{q.question_type}</span>
                  <button
                    onClick={() => { setEditTarget(q); setPanelOpen(true); }}
                    style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid rgba(3,72,82,0.2)", background: "transparent", cursor: "pointer", fontSize: "12px" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void handleRemoveQuestion(q.id)}
                    style={{ padding: "4px 10px", borderRadius: "4px", border: "1px solid #e53e3e", background: "transparent", color: "#e53e3e", cursor: "pointer", fontSize: "12px" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Add Section Modal ──────────────────────────────── */}
      {showAddModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
          style={{
            position: "fixed", inset: 0, zIndex: 99998,
            background: "rgba(3,72,82,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); void submitAddSection(); }}
            style={{
              background: "#fff", borderRadius: "16px",
              padding: "28px", maxWidth: "440px", width: "100%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}
          >
            <p style={{ fontSize: "18px", fontWeight: 800, color: "#034852", margin: "0 0 8px" }}>
              Add Section
            </p>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "0 0 20px" }}>
              Each section groups its own questions (e.g., Aptitude, Logical, Math).
            </p>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.7)", marginBottom: "6px" }}>
              Section Title
            </label>
            <input
              autoFocus
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setShowAddModal(false); }}
              placeholder="e.g., Aptitude"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1.5px solid rgba(3,72,82,0.15)",
                fontSize: "15px",
                color: "#034852",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: addError ? "8px" : "20px",
              }}
            />
            {addError && (
              <p style={{ fontSize: "13px", color: "#e53e3e", margin: "0 0 20px", lineHeight: 1.5 }}>
                {addError}
              </p>
            )}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={addingSection}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "rgba(3,72,82,0.08)",
                  color: "#034852",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: addingSection ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingSection || !newSectionTitle.trim()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  background: "linear-gradient(135deg,#0abe62,#209379)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: (addingSection || !newSectionTitle.trim()) ? "default" : "pointer",
                  opacity: (addingSection || !newSectionTitle.trim()) ? 0.6 : 1,
                }}
              >
                {addingSection ? "Adding…" : "Add Section"}
              </button>
            </div>
          </form>
        </div>
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
        <button
          title="Removes from this quiz. Question stays in the bank."
          style={{ ...S.outlineBtn, borderColor: "rgba(220,38,38,0.3)", color: "#dc2626" }}
          onClick={onRemove}
        >Remove</button>
      </div>
    </div>
  );
}

// ── Bank Picker Modal ──────────────────────────────────────────

function BankPickerModal({ quizId, sectionId, onClose, onPicked }: { quizId: string; sectionId?: string; onClose: () => void; onPicked: () => void }) {
  const [bankQs, setBankQs]             = useState<Question[]>([]);
  const [loadingBank, setLoadingBank]   = useState(true);
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [copying, setCopying]           = useState(false);
  const [err, setErr]                   = useState<string | null>(null);

  useEffect(() => {
    setLoadingBank(true);
    getQuestions()
      .then(setBankQs)
      .catch(() => setBankQs([]))
      .finally(() => setLoadingBank(false));
  }, []);

  const filtered = bankQs.filter(q =>
    stripHtml(q.content_html).toLowerCase().includes(search.toLowerCase()) ||
    (q.subject ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (q.topic ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleAttach() {
    if (selected.size === 0) return;
    setCopying(true);
    setErr(null);
    try {
      for (const qId of selected) {
        if (sectionId) {
          await attachQuestionToSection(quizId, sectionId, qId);
        } else {
          await attachQuizQuestion(quizId, qId);
        }
      }
      onPicked();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Attach failed.");
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
        background: "#ffffff",
        border: "1px solid rgba(255,255,255,0.3)",
        borderRadius: "24px", padding: "28px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
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
                onClick={() => setSelected(s => {
                  const n = new Set(s);
                  if (checked) n.delete(q.id);
                  else n.add(q.id);
                  return n;
                })}
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
            onClick={() => void handleAttach()}
            disabled={selected.size === 0 || copying}
            style={{ ...S.primaryBtn, flex: 2, opacity: selected.size === 0 || copying ? 0.5 : 1 }}
          >
            {copying ? "Adding…" : `Add ${selected.size > 0 ? selected.size + " " : ""}Question${selected.size !== 1 ? "s" : ""} to Quiz`}
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
  background: "#ffffff",
  borderRadius: "24px", padding: "28px 32px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
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
