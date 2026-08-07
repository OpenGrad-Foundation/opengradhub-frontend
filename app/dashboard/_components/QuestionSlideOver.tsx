"use client";

import { useState } from "react";
import {
  createQuestion,
  updateQuestion,
  addQuizQuestion,
  type Question,
  type EvaluationCriterion,
  type CreateChildPayload,
  type CreateQuestionPayload,
  type QuizAttemptQuestion,
  type AttemptReviewQuestion,
  uploadQuestionImage,
} from "@/lib/api";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MathTextEditor } from "./MathTextEditor";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { QuestionView, type AnswerMap } from "@/components/question-view";
import { PassageCard, QuestionReviewCard } from "@/components/question-review-card";
import { QuestionReportsPanel } from "./QuestionReportsPanel";

// ── Shared constants ───────────────────────────────────────────

export const QUESTION_TYPES = [
  { value: "MCQ",       label: "Multiple Choice (MCQ)" },
  { value: "FILL",      label: "Fill in the Blank" },
  { value: "NUMERICAL", label: "Numerical" },
  { value: "GROUP",     label: "Group Question" },
  { value: "ESSAY",     label: "Essay (Manual Grading)" },
] as const;

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export type QType = "MCQ" | "FILL" | "NUMERICAL" | "GROUP" | "ESSAY";

export type DraftOption = { _key: number; option_text: string; is_correct: boolean };
export type DraftEvaluationCriterion = { _key: number; criteria: string; percentage: string };
export type DraftChild = Omit<CreateChildPayload, "options"> & { id?: string; _key: number; options: DraftOption[] };

// Monotonically increasing key generator — stable across re-renders unlike nextKey().
let _nextKey = 1;
function nextKey(): number { return _nextKey++; }

// ── Factories ──────────────────────────────────────────────────

export function emptyOption(): DraftOption {
  return { option_text: "", is_correct: false, _key: nextKey() };
}

export function emptyChild(): DraftChild {
  return {
    _key: nextKey(),
    question_type: "MCQ",
    content_html: "",
    options: [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
  };
}

// ── Shared small components ────────────────────────────────────

export function stripHtml(html: string): string {
  // Keeping stripHtml just in case it's needed for fallback, but removing its usage from initial state
  return html.replace(/<[^>]*>/g, "").trim();
}

export function typeBadge(type: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    MCQ:       { bg: "rgba(32,147,121,0.12)", color: "#209379" },
    FILL:      { bg: "rgba(10,190,98,0.12)",  color: "#0abe62" },
    NUMERICAL: { bg: "rgba(255,222,0,0.2)",   color: "#956f00" },
    GROUP:     { bg: "rgba(3,72,82,0.1)",     color: "#034852" },
    ESSAY:     { bg: "rgba(147,32,121,0.12)", color: "#932079" },
  };
  const { bg, color } = map[type] ?? { bg: "rgba(0,0,0,0.06)", color: "#444" };
  return {
    display: "inline-block", padding: "3px 9px", borderRadius: "100px",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", background: bg, color,
  };
}

export function Tag({ children, variant }: { children: React.ReactNode; variant?: string }) {
  const bg =
    variant === "EASY"   ? "rgba(10,190,98,0.1)"  :
    variant === "HARD"   ? "rgba(220,38,38,0.1)"  :
    variant === "MEDIUM" ? "rgba(255,222,0,0.2)"  :
    "rgba(3,72,82,0.07)";
  const color =
    variant === "EASY"   ? "#0abe62"           :
    variant === "HARD"   ? "#dc2626"           :
    variant === "MEDIUM" ? "#956f00"           :
    "rgba(3,72,82,0.6)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", background: bg, color }}>
      {children}
    </span>
  );
}

export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.6)" }}>{label}</p>
      {children}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

/**
 * QuestionSlideOver
 *
 * Used by both /test-bank and /quiz-builder.
 * - When `quizId` is provided: new questions go to the quiz via POST /quizzes/:id/questions.
 * - When `quizId` is absent: new questions go to the bank via POST /questions.
 * - Edit mode always uses PATCH /questions/:id regardless of context.
 */
export function QuestionSlideOver({
  initial,
  createdBy,
  quizId,
  onClose,
  onSaved,
  onCreated,
}: {
  initial: Question | null;
  createdBy: string;
  quizId?: string;
  onClose: () => void;
  onSaved: () => void;
  /** Called after a brand-new question is created in the bank (quizId absent). Receives the created Question. */
  onCreated?: (q: Question) => Promise<void>;
}) {
  const isEdit = !!initial;
  const inQuiz = !!quizId;
  const invalidate = useInvalidate();

  const [qType, setQType] = useState<QType>((initial?.question_type as QType) ?? "MCQ");
  const [content, setContent] = useState(initial ? initial.content_html : "");
  const [progType, setProgType] = useState(initial?.programme_type ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "");
  const [explanationVideoUrl, setExplanationVideoUrl] = useState(initial?.explanation_video_url ?? "");
  const [marks, setMarks] = useState(initial?.marks?.toString() ?? "");
  const [negativeMarks, setNegativeMarks] = useState(initial?.negative_marks?.toString() ?? "");
  const [answerTime, setAnswerTime] = useState(initial?.answer_time_minutes?.toString() ?? "");
  const [instruction, setInstruction] = useState(initial?.instruction_html ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "");
  const [solution, setSolution] = useState(initial?.solution ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [evaluationCriteria, setEvaluationCriteria] = useState<DraftEvaluationCriterion[]>(() => {
    try {
      const raw = initial?.evaluation_criteria_json;
      const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? []);
      if (Array.isArray(parsed)) {
        return (parsed as EvaluationCriterion[]).map((c) => ({ _key: nextKey(), criteria: c.criteria || "", percentage: c.percentage?.toString() || "" }));
      }
    } catch {
      console.warn("Failed to parse evaluation_criteria_json:", initial?.evaluation_criteria_json);
    }
    return [];
  });

  const [options, setOptions] = useState<DraftOption[]>(() => {
    if (initial?.question_type === "MCQ" && initial.options.length > 0) {
      return initial.options.map(o => ({ ...o, _key: nextKey() }));
    }
    return [emptyOption(), emptyOption(), emptyOption(), emptyOption()];
  });

  const [correctAnswer, setCorrectAnswer] = useState(initial?.correct_answer ?? "");
  const [tolerance, setTolerance] = useState(initial?.tolerance?.toString() ?? "");

  const [children, setChildren] = useState<DraftChild[]>(
    () => initial?.question_type === "GROUP"
      ? initial.children.map(c => ({
          id: c.id,
          _key: nextKey(),
          question_type: c.question_type as "MCQ" | "FILL" | "NUMERICAL",
          content_html: c.content_html || "",
          correct_answer: c.correct_answer ?? "",
          tolerance: c.tolerance ?? undefined,
          marks: c.marks ?? undefined,
          negative_marks: c.negative_marks ?? undefined,
          subject: c.subject ?? undefined,
          topic: c.topic ?? undefined,
          difficulty: c.difficulty ?? undefined,
          tag: c.tag ?? undefined,
          image_url: c.image_url ?? undefined,
          explanation_video_url: c.explanation_video_url ?? undefined,
          solution: c.solution ?? undefined,
          options: c.question_type === "MCQ"
            ? c.options.map(o => ({ ...o, _key: nextKey() }))
            : [emptyOption(), emptyOption(), emptyOption(), emptyOption()],
        }))
      : [],
  );

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  function handleTypeChange(t: QType) {
    setQType(t);
    setCorrectAnswer("");
    setTolerance("");
    if (t === "MCQ") setOptions([emptyOption(), emptyOption(), emptyOption(), emptyOption()]);
    if (t === "GROUP") setChildren([emptyChild()]);
  }

  // ── Option helpers ─────────────────────────────────────────────

  const setOptionText = (key: number, text: string) =>
    setOptions(p => p.map(o => o._key === key ? { ...o, option_text: text } : o));
  const setOptionCorrect = (key: number) =>
    setOptions(p => p.map(o => ({ ...o, is_correct: o._key === key })));
  const addOption = () => setOptions(p => [...p, emptyOption()]);
  const removeOption = (key: number) => setOptions(p => p.filter(o => o._key !== key));

  // ── Evaluation Criteria helpers ────────────────────────────────
  const addEvalCriterion = () => setEvaluationCriteria(p => [...p, { _key: nextKey(), criteria: "", percentage: "" }]);
  const removeEvalCriterion = (key: number) => setEvaluationCriteria(p => p.filter(c => c._key !== key));
  const updateEvalCriterion = (key: number, field: "criteria" | "percentage", value: string) => 
    setEvaluationCriteria(p => p.map(c => c._key === key ? { ...c, [field]: value } : c));

  // ── Child helpers ──────────────────────────────────────────────

  const setChildType = (key: number, t: "MCQ" | "FILL" | "NUMERICAL") =>
    setChildren(p => p.map(c => c._key === key
      ? { ...c, question_type: t, options: t === "MCQ" ? [emptyOption(), emptyOption(), emptyOption(), emptyOption()] : c.options }
      : c));
  const setChildContent = (key: number, text: string) =>
    setChildren(p => p.map(c => c._key === key ? { ...c, content_html: text } : c));
  const setChildAnswer = (key: number, text: string) =>
    setChildren(p => p.map(c => c._key === key ? { ...c, correct_answer: text } : c));
  const setChildMarks = (key: number, val: string) =>
    setChildren(p => p.map(c => c._key === key ? { ...c, marks: val ? Number(val) : undefined } : c));
  const setChildNegativeMarks = (key: number, val: string) =>
    setChildren(p => p.map(c => c._key === key ? { ...c, negative_marks: val ? Number(val) : undefined } : c));
  const setChildField = (key: number, field: keyof DraftChild, val: string) =>
    setChildren(p => p.map(c => c._key === key ? { ...c, [field]: val || undefined } : c));
  const setChildOptText = (ck: number, ok: number, text: string) =>
    setChildren(p => p.map(c => c._key === ck
      ? { ...c, options: c.options.map(o => o._key === ok ? { ...o, option_text: text } : o) }
      : c));
  const setChildOptCorrect = (ck: number, ok: number) =>
    setChildren(p => p.map(c => c._key === ck
      ? { ...c, options: c.options.map(o => ({ ...o, is_correct: o._key === ok })) }
      : c));
  const addChild = () => setChildren(p => [...p, emptyChild()]);
  const removeChild = (key: number) => setChildren(p => p.filter(c => c._key !== key));

  // ── Image Upload ────────────────────────────────────────────────

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    setFormError(null);
    try {
      const res = await uploadQuestionImage(file);
      // The backend returns { key: string }. We use this key directly, which gets presigned by /quizzes/images
      setter(res.key);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setIsUploadingImage(false);
      e.target.value = ""; // Reset input
    }
  }

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!content.trim()) { setFormError("Question content is required."); return; }
    if (qType === "MCQ") {
      const filledOptions = options.filter(o => o.option_text.trim());
      if (filledOptions.length < 2) { setFormError("Provide at least 2 options."); return; }
      if (!filledOptions.some(o => o.is_correct)) { setFormError("Mark at least one filled-in option as correct."); return; }
    }
    if ((qType === "FILL" || qType === "NUMERICAL") && !correctAnswer.trim()) {
      setFormError("Correct answer is required."); return;
    }
    if (qType === "GROUP" && children.length === 0) { setFormError("Add at least one child question."); return; }

    setSubmitting(true);
    try {
      const base = {
        content_html: content.trim(),
        programme_type: progType || undefined,
        subject: subject || undefined,
        topic: topic || undefined,
        difficulty: difficulty || undefined,
        explanation_video_url: explanationVideoUrl.trim() || undefined,
        marks: marks ? Number(marks) : undefined,
        negative_marks: negativeMarks ? Number(negativeMarks) : undefined,
        answer_time_minutes: answerTime ? Number(answerTime) : undefined,
        instruction_html: instruction.trim() || undefined,
        tag: tag.trim() || undefined,
        solution: solution.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        evaluation_criteria_json: evaluationCriteria.length > 0
          ? evaluationCriteria.filter(c => c.criteria.trim()).map(c => ({ criteria: c.criteria.trim(), percentage: c.percentage ? Number(c.percentage) : 0 }))
          : undefined,
      };

      if (isEdit) {
        const patch: Parameters<typeof updateQuestion>[1] = { ...base };
        if (qType === "MCQ") {
          patch.options = options.filter(o => o.option_text.trim()).map(({ option_text, is_correct }) => ({ option_text, is_correct }));
        }
        if (qType === "FILL" || qType === "NUMERICAL") {
          patch.correct_answer = correctAnswer;
          patch.tolerance = qType === "NUMERICAL" && tolerance ? Number(tolerance) : null;
        }
        if (qType === "GROUP") {
          patch.children = children.map(c => {
            const child: CreateChildPayload = {
              id: c.id,
              question_type: c.question_type,
              content_html: c.content_html,
              correct_answer: c.correct_answer || undefined,
              marks: c.marks,
              negative_marks: c.negative_marks,
              subject: c.subject,
              topic: c.topic,
              difficulty: c.difficulty,
              tag: c.tag,
              image_url: c.image_url,
              explanation_video_url: c.explanation_video_url,
              solution: c.solution
            };
            if (c.question_type === "MCQ") {
              child.options = c.options.filter(o => o.option_text.trim()).map(({ option_text, is_correct }) => ({ option_text, is_correct }));
            }
            return child;
          });
        }
        await updateQuestion(initial!.id, patch);
        invalidate('quizzes');
      } else {
        const payload: CreateQuestionPayload = { question_type: qType, created_by: createdBy || undefined, ...base };
        if (qType === "MCQ") {
          payload.options = options.filter(o => o.option_text.trim()).map(({ option_text, is_correct }) => ({ option_text, is_correct }));
        }
        if (qType === "FILL" || qType === "NUMERICAL") {
          payload.correct_answer = correctAnswer;
          if (qType === "NUMERICAL" && tolerance) payload.tolerance = Number(tolerance);
        }
        if (qType === "GROUP") {
          payload.children = children.map(c => {
            const child: CreateChildPayload = { 
              question_type: c.question_type, 
              content_html: c.content_html, 
              correct_answer: c.correct_answer || undefined,
              marks: c.marks,
              negative_marks: c.negative_marks,
              subject: c.subject,
              topic: c.topic,
              difficulty: c.difficulty,
              tag: c.tag,
              image_url: c.image_url,
              explanation_video_url: c.explanation_video_url,
              solution: c.solution
            };
            if (c.question_type === "MCQ") {
              child.options = c.options.filter(o => o.option_text.trim()).map(({ option_text, is_correct }) => ({ option_text, is_correct }));
            }
            return child;
          });
        }
        // Route to quiz or bank depending on context
        if (inQuiz && quizId) {
          await addQuizQuestion(quizId, payload);
          invalidate('quizzes');
        } else {
          const created = await createQuestion(payload);
          invalidate('quizzes');
          if (onCreated) await onCreated(created);
        }
      }
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const [previewAnswers, setPreviewAnswers] = useState<AnswerMap>({});
  const [previewMode, setPreviewMode] = useState<"TAKING" | "REVIEW">("TAKING");

  const mockQ: QuizAttemptQuestion = {
    snapshot_id: "preview",
    section_id: null,
    question_type: qType,
    content_html: content || "<p style='color: #aaa'>Question content...</p>",
    instruction_html: instruction || null,
    tolerance: qType === "NUMERICAL" && tolerance ? Number(tolerance) : null,
    image_url: imageUrl || null,
    options: options.filter(o => o.option_text.trim()).map(o => ({ id: String(o._key), option_text: o.option_text })),
    children: children.map(c => ({
      snapshot_id: String(c._key),
      section_id: null,
      question_type: c.question_type,
      content_html: c.content_html || "<p style='color: #aaa'>Sub-question content...</p>",
      instruction_html: null,
      tolerance: c.tolerance ?? null,
      image_url: c.image_url ?? null,
      options: c.options.filter(o => o.option_text.trim()).map(o => ({ id: String(o._key), option_text: o.option_text })),
      children: [],
    })),
  };

  const panelTitle = isEdit ? "Update question" : inQuiz ? "Add to quiz" : "Add to bank";

  return (
    <>
      <style>{`
        @media (max-width: 1024px) {
          .live-preview-panel { display: none !important; }
        }
      `}</style>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }} />
      
      <div className="live-preview-panel" style={{
        position: "fixed", top: 0, left: 0, bottom: 0, right: "600px",
        zIndex: 41, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px", overflowY: "auto", pointerEvents: "none"
      }}>
        <div style={{
          width: "100%", maxWidth: "800px", background: "#fff",
          borderRadius: "16px", padding: "32px", boxShadow: "0 12px 48px rgba(3,72,82,0.15)",
          pointerEvents: "auto", maxHeight: "100%", overflowY: "auto"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0abe62", margin: 0 }}>Live Preview</p>
            
            <div style={{ display: "flex", background: "rgba(3,72,82,0.06)", borderRadius: "100px", padding: "4px" }}>
              <button
                type="button"
                onClick={() => setPreviewMode("TAKING")}
                style={{
                  ...S.ghost, padding: "6px 14px", borderRadius: "100px", color: previewMode === "TAKING" ? "#fff" : "rgba(3,72,82,0.6)",
                  background: previewMode === "TAKING" ? "#034852" : "transparent", transition: "all 0.2s"
                }}
              >
                Taking
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("REVIEW")}
                style={{
                  ...S.ghost, padding: "6px 14px", borderRadius: "100px", color: previewMode === "REVIEW" ? "#fff" : "rgba(3,72,82,0.6)",
                  background: previewMode === "REVIEW" ? "#0abe62" : "transparent", transition: "all 0.2s"
                }}
              >
                Review
              </button>
            </div>
          </div>
          
          {previewMode === "TAKING" ? (
            <QuestionView q={mockQ} answers={previewAnswers} setAnswer={(sid, val) => setPreviewAnswers(p => ({ ...p, [sid]: val }))} />
          ) : (
            qType === "GROUP" ? (
              <div>
                <PassageCard html={content || "<p style='color: #aaa'>Question content...</p>"} imageUrl={imageUrl || null} />
                {children.map((child, i) => {
                  const studentAns = previewAnswers[String(child._key)] ?? null;
                  let isCorrect: boolean | null = null;
                  if (child.question_type === "MCQ") {
                    isCorrect = studentAns ? (child.options.find(o => String(o._key) === studentAns)?.is_correct ?? false) : false;
                  } else if (child.question_type === "NUMERICAL" || child.question_type === "FILL") {
                    isCorrect = studentAns?.trim().toLowerCase() === child.correct_answer?.trim().toLowerCase();
                  }
                  
                  const rq: AttemptReviewQuestion = {
                    snapshot_id: String(child._key),
                    section_id: null,
                    question_type: child.question_type,
                    content_html: child.content_html || "<p style='color: #aaa'>Sub-question content...</p>",
                    image_url: child.image_url ?? null,
                    parent_snapshot_id: "preview",
                    parent_content_html: content,
                    parent_image_url: imageUrl,
                    student_answer: studentAns,
                    correct_answer: child.correct_answer || null,
                    is_correct: isCorrect,
                    marks_awarded: isCorrect ? (Number(child.marks) || 1) : 0,
                    time_taken_seconds: 45,
                    explanation_video_url: child.explanation_video_url ?? null,
                    options: child.options.filter(o => o.option_text.trim()).map(o => ({ id: String(o._key), option_text: o.option_text, is_correct: !!o.is_correct })),
                    avg_time_seconds: 60,
                    batch_correct_count: 75,
                    batch_total_count: 100,
                    solution_html: child.solution ?? null,
                  };
                  return <QuestionReviewCard key={child._key} q={rq} idx={i + 1} revealed={true} />;
                })}
              </div>
            ) : (
              (() => {
                const studentAns = previewAnswers["preview"] ?? null;
                let isCorrect: boolean | null = null;
                if (qType === "MCQ") {
                  isCorrect = studentAns ? (options.find(o => String(o._key) === studentAns)?.is_correct ?? false) : false;
                } else if (qType === "NUMERICAL" || qType === "FILL") {
                  isCorrect = studentAns?.trim().toLowerCase() === correctAnswer?.trim().toLowerCase();
                }
                const rq: AttemptReviewQuestion = {
                  snapshot_id: "preview",
                  section_id: null,
                  question_type: qType,
                  content_html: content || "<p style='color: #aaa'>Question content...</p>",
                  image_url: imageUrl || null,
                  parent_snapshot_id: null,
                  parent_content_html: null,
                  parent_image_url: null,
                  student_answer: studentAns,
                  correct_answer: correctAnswer || null,
                  is_correct: isCorrect,
                  marks_awarded: isCorrect ? (Number(marks) || 1) : 0,
                  time_taken_seconds: 45,
                  explanation_video_url: explanationVideoUrl || null,
                  options: options.filter(o => o.option_text.trim()).map(o => ({ id: String(o._key), option_text: o.option_text, is_correct: !!o.is_correct })),
                  avg_time_seconds: 60,
                  batch_correct_count: 75,
                  batch_total_count: 100,
                  solution_html: solution || null,
                };
                return <QuestionReviewCard q={rq} idx={1} revealed={true} />;
              })()
            )
          )}
        </div>
      </div>

      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(600px, 100vw)",
        background: "#ffffff",
        borderLeft: "1px solid rgba(3,72,82,0.1)",
        boxShadow: "-24px 0 64px rgba(3,72,82,0.12)",
        zIndex: 41, overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 28px 0" }}>
          <div>
            <p style={S.label}>{isEdit ? "Edit" : "New"} Question</p>
            <h2 style={{ ...S.heading, fontSize: "20px", margin: "4px 0 0" }}>{panelTitle}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", color: "rgba(3,72,82,0.4)", cursor: "pointer" }}>✕</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ flex: 1, padding: "24px 28px 32px", display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* Type selector */}
          <FieldGroup label="Question Type *">
            <select value={qType} onChange={e => handleTypeChange(e.target.value as QType)} disabled={isEdit} style={{ ...S.input, opacity: isEdit ? 0.6 : 1 }}>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {isEdit && <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.45)", margin: "4px 0 0" }}>Type cannot be changed after creation.</p>}
          </FieldGroup>

          {/* Content */}
          <FieldGroup label="Content *">
            <RichTextEditor
              value={content}
              onChange={setContent}
              minHeight={150}
              placeholder="Enter question text..."
            />
          </FieldGroup>

          {/* Tags */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FieldGroup label="Programme Type">
              <select value={progType} onChange={e => setProgType(e.target.value)} style={S.input}>
                <option value="">None</option>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Difficulty">
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={S.input}>
                <option value="">None</option>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </FieldGroup>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FieldGroup label="Subject"><input value={subject} onChange={e => setSubject(e.target.value)} style={S.input} placeholder="e.g. Mathematics" /></FieldGroup>
            <FieldGroup label="Topic"><input value={topic} onChange={e => setTopic(e.target.value)} style={S.input} placeholder="e.g. Arithmetic" /></FieldGroup>
          </div>
          <FieldGroup label="Explanation Video URL (optional)">
            <input
              value={explanationVideoUrl}
              onChange={e => setExplanationVideoUrl(e.target.value)}
              style={S.input}
              placeholder="YouTube URL shown after quiz submission"
              type="url"
            />
          </FieldGroup>

          {/* New fields: Marks, Negative Marks, Answer Time, Instruction */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <FieldGroup label="Marks"><input type="number" step="any" value={marks} onChange={e => setMarks(e.target.value)} style={S.input} placeholder="Default" /></FieldGroup>
            <FieldGroup label="Negative Marks"><input type="number" step="any" min="0" value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} style={S.input} placeholder="Default" /></FieldGroup>
            <FieldGroup label="Time (min)"><input type="number" step="any" min="0" value={answerTime} onChange={e => setAnswerTime(e.target.value)} style={S.input} placeholder="Optional" /></FieldGroup>
          </div>
          
          <FieldGroup label="Question Instruction (optional)">
            <RichTextEditor
              minHeight={70}
              value={instruction}
              onChange={setInstruction}
              placeholder="e.g. Read the passage and answer..."
              disableImageUpload
            />
          </FieldGroup>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <FieldGroup label="Tag">
              <input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} style={S.input} placeholder="e.g. FUNCTIONS" />
            </FieldGroup>
            <div></div>
          </div>

          <FieldGroup label="Solution (optional)">
            <RichTextEditor
              minHeight={100}
              value={solution}
              onChange={setSolution}
              placeholder="Explanation shown after quiz completion..."
            />
          </FieldGroup>

          {/* MCQ options */}
          {qType === "MCQ" && (
            <div>
              <p style={S.sectionLabel}>Options — click radio to mark correct</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {options.map((opt, i) => (
                  <div key={opt._key} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                    <input type="radio" name="correct-option" value={String(opt._key)} checked={opt.is_correct} onChange={() => setOptionCorrect(opt._key)} onClick={() => setOptionCorrect(opt._key)} style={{ accentColor: "#0abe62", width: "16px", height: "16px", flexShrink: 0, cursor: "pointer", marginTop: "32px" }} title="Mark as correct" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <RichTextEditor minHeight={50} value={opt.option_text} onChange={v => setOptionText(opt._key, v)} placeholder={`Option ${i + 1}`} disableImageUpload />
                    </div>
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(opt._key)} style={{ background: "none", border: "none", color: "rgba(220,38,38,0.6)", cursor: "pointer", fontSize: "16px", padding: "0 4px", marginTop: "28px" }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addOption} style={{ ...S.ghost, marginTop: "8px" }}>+ Add option</button>
            </div>
          )}

          {/* Fill */}
          {qType === "FILL" && (
            <FieldGroup label="Correct Answer *">
              <MathTextEditor
                compact
                rows={1}
                value={correctAnswer}
                onChange={setCorrectAnswer}
                placeholder="Expected answer"
                hint="Math renders for display; grading compares the raw text."
              />
            </FieldGroup>
          )}

          {/* Numerical */}
          {qType === "NUMERICAL" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <FieldGroup label="Correct Answer *"><input type="number" step="any" value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} style={S.input} placeholder="e.g. 42.5" /></FieldGroup>
              <FieldGroup label="Tolerance (±)"><input type="number" step="any" min="0" value={tolerance} onChange={e => setTolerance(e.target.value)} style={S.input} placeholder="e.g. 0.5" /></FieldGroup>
            </div>
          )}

          {/* Essay */}
          {qType === "ESSAY" && (
            <FieldGroup label="Evaluation Criteria (Optional)">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {evaluationCriteria.map((c, i) => (
                  <div key={c._key} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input 
                      type="text" 
                      value={c.criteria} 
                      onChange={e => updateEvalCriterion(c._key, "criteria", e.target.value)} 
                      style={{ ...S.input, flex: 1 }} 
                      placeholder="e.g. Grammar and clarity" 
                    />
                    <input 
                      type="number" 
                      value={c.percentage} 
                      onChange={e => updateEvalCriterion(c._key, "percentage", e.target.value)} 
                      style={{ ...S.input, width: "80px" }} 
                      placeholder="Weight %" 
                    />
                    <button type="button" onClick={() => removeEvalCriterion(c._key)} style={{ background: "none", border: "none", color: "rgba(220,38,38,0.6)", cursor: "pointer", padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addEvalCriterion} style={{ ...S.ghost, marginTop: "8px" }}>+ Add criterion</button>
            </FieldGroup>
          )}

          {/* Group children */}
          {qType === "GROUP" && (
            <div>
              <p style={S.sectionLabel}>Sub-Questions ({children.length})</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {children.map((child, ci) => (
                  <div key={child._key} style={{ background: "rgba(3,72,82,0.03)", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "12px", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#209379", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sub-question {ci + 1}</span>
                      <button type="button" onClick={() => removeChild(child._key)} style={{ background: "none", border: "none", color: "rgba(220,38,38,0.6)", cursor: "pointer", fontSize: "14px" }}>Remove</button>
                    </div>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <select value={child.question_type} onChange={e => setChildType(child._key, e.target.value as "MCQ" | "FILL" | "NUMERICAL")} style={S.input}>
                        <option value="MCQ">MCQ</option>
                        <option value="FILL">Fill in the Blank</option>
                        <option value="NUMERICAL">Numerical</option>
                      </select>
                      <RichTextEditor minHeight={70} value={child.content_html} onChange={v => setChildContent(child._key, v)} placeholder="Sub-question content…" />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <input type="number" step="any" value={child.marks ?? ""} onChange={e => setChildMarks(child._key, e.target.value)} style={S.input} placeholder="Marks (default: 1)" />
                        <input type="number" step="any" min="0" value={child.negative_marks ?? ""} onChange={e => setChildNegativeMarks(child._key, e.target.value)} style={S.input} placeholder="Negative Marks" />
                      </div>
                      
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <input type="text" value={child.subject ?? ""} onChange={e => setChildField(child._key, "subject", e.target.value)} style={S.input} placeholder="Subject" />
                        <input type="text" value={child.topic ?? ""} onChange={e => setChildField(child._key, "topic", e.target.value)} style={S.input} placeholder="Topic" />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <select value={child.difficulty ?? ""} onChange={e => setChildField(child._key, "difficulty", e.target.value)} style={S.input}>
                          <option value="">Difficulty (Optional)</option>
                          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input type="text" value={child.tag ?? ""} onChange={e => setChildField(child._key, "tag", e.target.value)} style={S.input} placeholder="Tag (e.g., Comprehension)" />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                        <input type="text" value={child.explanation_video_url ?? ""} onChange={e => setChildField(child._key, "explanation_video_url", e.target.value)} style={S.input} placeholder="Video URL (Optional)" />
                      </div>
                      <RichTextEditor minHeight={70} value={child.solution ?? ""} onChange={v => setChildField(child._key, "solution", v)} placeholder="Solution (Optional)…" />

                      {(child.question_type === "FILL" || child.question_type === "NUMERICAL") && (
                        <input value={child.correct_answer ?? ""} onChange={e => setChildAnswer(child._key, e.target.value)} style={S.input} placeholder="Correct answer" />
                      )}
                      {child.question_type === "MCQ" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {child.options.map((opt, oi) => (
                            <div key={opt._key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <input type="radio" name={`child-${child._key}-correct`} value={String(opt._key)} checked={opt.is_correct} onChange={() => setChildOptCorrect(child._key, opt._key)} onClick={() => setChildOptCorrect(child._key, opt._key)} style={{ accentColor: "#0abe62", width: "14px", height: "14px", flexShrink: 0, cursor: "pointer" }} />
                              <input value={opt.option_text} onChange={e => setChildOptText(child._key, opt._key, e.target.value)} style={{ ...S.input, fontSize: "13px" }} placeholder={`Option ${oi + 1}`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addChild} style={{ ...S.ghost, marginTop: "10px" }}>+ Add sub-question</button>
              {isEdit && <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.45)", marginTop: "6px" }}>Sub-questions are read-only when editing a GROUP question.</p>}
            </div>
          )}

          {/* Reports only exist for a saved question. */}
          {initial && <QuestionReportsPanel questionId={initial.id} />}

          {formError && <p style={{ fontSize: "13px", color: "#e53e3e", fontWeight: 600, margin: 0 }}>{formError}</p>}

          <div style={{ display: "flex", gap: "10px", marginTop: "auto", paddingTop: "8px" }}>
            <button type="button" onClick={onClose} style={{ ...S.primary, flex: 1, background: "rgba(3,72,82,0.07)", color: "#034852", boxShadow: "none" }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...S.primary, flex: 2, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : inQuiz ? "Add to Quiz" : "Add to Bank"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Internal styles ────────────────────────────────────────────

const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379", margin: 0,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852",
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "rgba(3,72,82,0.55)", margin: "0 0 10px",
  } as React.CSSProperties,
  primary: {
    padding: "11px 22px", border: "none", borderRadius: "12px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700,
    fontSize: "14px", cursor: "pointer",
    boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
    transition: "all 240ms ease", whiteSpace: "nowrap",
  } as React.CSSProperties,
  ghost: {
    background: "none", border: "none", padding: "6px 10px",
    fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600,
    color: "#0abe62", cursor: "pointer",
  } as React.CSSProperties,
  input: {
    width: "100%", padding: "10px 14px",
    background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: "10px", color: "#034852",
    fontFamily: "var(--font-body)", fontSize: "14px",
    outline: "none", boxSizing: "border-box",
  } as React.CSSProperties,
};
