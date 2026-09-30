"use client";

import { useEffect, useState } from "react";
import type { Quiz, Question, QuizAttemptQuestion } from "@/lib/api";
import type { AttemptReviewQuestion } from "@/lib/api";
import { type AnswerMap } from "@/components/question-view";
import { QuizExam } from "@/components/quiz-exam";
import { flattenGroups } from "@/lib/flatten-groups";
import { CalculatorWindow } from "@/components/calculator-window";
import examStyles from "./quiz-exam.module.css";
import reviewStyles from "./question-review.module.css";
import { PassageCard, QuestionReviewCard } from "@/components/question-review-card";

// ── Data conversion ───────────────────────────────────────────────────────────

function toAttemptQ(q: Question, sectionId?: string): QuizAttemptQuestion {
  return {
    snapshot_id: q.id,
    section_id: sectionId ?? null,
    question_type: q.question_type,
    content_html: q.content_html,
    instruction_html: q.instruction_html ?? null,
    tolerance: q.tolerance,
    image_url: q.image_url ?? null,
    options: q.options.map((o) => ({ id: o.id, option_text: o.option_text })),
    children: (q.children ?? []).map((c) => toAttemptQ(c, sectionId)),
  };
}

function toReviewQ(q: Question, answers: AnswerMap, parentQ?: Question): AttemptReviewQuestion {
  const studentAns = answers[q.id] ?? null;
  let isCorrect: boolean | null = null;
  if (q.question_type === "MCQ") {
     isCorrect = studentAns ? (q.options.find(o => o.id === studentAns)?.is_correct ?? false) : false;
  } else if (q.question_type === "NUMERICAL" || q.question_type === "FILL") {
     isCorrect = !!studentAns?.trim() && !!q.correct_answer?.trim()
       && studentAns.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
  }

  return {
    snapshot_id: q.id,
    section_id: null,
    question_type: q.question_type,
    content_html: q.content_html,
    instruction_html: q.instruction_html ?? null,
    image_url: q.image_url ?? null,
    parent_snapshot_id: parentQ?.id ?? null,
    parent_content_html: parentQ?.content_html ?? null,
    parent_instruction_html: parentQ?.instruction_html ?? null,
    parent_image_url: parentQ?.image_url ?? null,
    student_answer: studentAns,
    correct_answer: q.correct_answer ?? null,
    is_correct: isCorrect,
    marks_awarded: isCorrect ? (q.marks ?? 1) : 0,
    time_taken_seconds: null,
    explanation_video_url: q.explanation_video_url ?? null,
    options: q.options.map(o => ({ id: o.id, option_text: o.option_text, is_correct: !!o.is_correct })),
    avg_time_seconds: null,
    batch_correct_count: 0,
    batch_total_count: 0,
    solution_html: q.solution ?? null,
  };
}

type PreviewSection = {
  id: string;
  title: string;
  questions: QuizAttemptQuestion[];
};

function buildSections(quiz: Quiz): PreviewSection[] {
  if (quiz.is_sectioned && quiz.sections.length > 0) {
    return quiz.sections.map((s) => ({
      id: s.id,
      title: s.title,
      questions: s.questions.map((q) => toAttemptQ(q, s.id)),
    }));
  }
  return [{ id: "__all__", title: "All Questions", questions: quiz.questions.map((q) => toAttemptQ(q)) }];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuizStudentPreview({ quiz, onClose }: { quiz: Quiz; onClose: () => void }) {
  const isSectioned = quiz.is_sectioned && quiz.sections.length > 0;
  const sections = buildSections(quiz);

  // Flatten all questions in order (same as real quiz: attempt.questions)
  const allQuestions: QuizAttemptQuestion[] = flattenGroups(sections.flatMap((s) => s.questions));
  const total = allQuestions.length;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<"TAKING" | "REVIEW">("TAKING");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(() => new Set(allQuestions[0] ? [allQuestions[0].snapshot_id] : []));
  const [calcOpen, setCalcOpen] = useState(false);

  const safeIdx = Math.min(currentIdx, total - 1);
  const q = allQuestions[safeIdx];

  // Section tab state: derive from current question's section_id
  const currentSectionId = q?.section_id ?? null;

  function setAnswer(snapshotId: string, val: string | null) {
    setAnswers((prev) => ({ ...prev, [snapshotId]: val }));
  }

  function toggleFlag(snapshotId: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(snapshotId)) next.delete(snapshotId);
      else next.add(snapshotId);
      return next;
    });
  }

  function navigate(index: number) {
    setCurrentIdx(index);
    setVisited(prev => new Set(prev).add(allQuestions[index].snapshot_id));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !e.defaultPrevented) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!q) return null;

  if (mode === "REVIEW") {
    const reviewQs: AttemptReviewQuestion[] = [];
    const originalQuestions = isSectioned ? quiz.sections.flatMap(s => s.questions) : quiz.questions;
    
    originalQuestions.forEach(qItem => {
      if (qItem.question_type === "GROUP") {
        qItem.children?.forEach(child => reviewQs.push(toReviewQ(child, answers, qItem)));
      } else {
        reviewQs.push(toReviewQ(qItem, answers));
      }
    });

    const correct = reviewQs.filter(rq => rq.is_correct === true).length;
    const totalQuestions = reviewQs.length;
    const seenParents = new Set<string>();
    
    return (
      <div className={reviewStyles.preview}>
        <header className={reviewStyles.topbar}>
          <span>OpenGradHub <span className={reviewStyles.previewLabel}>/ Review preview</span></span>
          <div><button onClick={() => setMode("TAKING")}>Back to quiz</button><button onClick={onClose}>Exit preview</button></div>
        </header>
        <main className={reviewStyles.reviewPage}>
          <div className={reviewStyles.summary}>
            <div><p>{quiz.title}</p><h1>Answer review</h1></div>
            <p><strong>{correct} / {totalQuestions}</strong> correct in this preview</p>
          </div>
          {reviewQs.map((rq, idx) => {
            const hasParent = rq.parent_snapshot_id != null;
            const isFirstOfParent = hasParent && !seenParents.has(rq.parent_snapshot_id!);
            if (isFirstOfParent) seenParents.add(rq.parent_snapshot_id!);

            return (
              <div key={rq.snapshot_id}>
                {isFirstOfParent && (
                  <PassageCard html={rq.parent_content_html ?? ""} imageUrl={rq.parent_image_url ?? null} instructionHtml={rq.parent_instruction_html ?? null} />
                )}
                <QuestionReviewCard q={rq} idx={idx} allowRetry questionLabel={`Question ${idx + 1}`} showAnalytics={false} />
              </div>
            );
          })}
        </main>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, overflowY: "auto", fontFamily: "Arial, Helvetica, sans-serif", color: "#034852" }}>
      <QuizExam title={quiz.title} badge="Preview"
        timer={quiz.duration_minutes ? `${quiz.duration_minutes}:00` : "—"} timerLabel="Preview timer"
        notice={<div className={examStyles.notice}><span>Student preview · answers are not saved or graded</span><button type="button" onClick={onClose}>Exit preview</button></div>}
        questions={allQuestions} currentIdx={safeIdx} answers={answers} flagged={flagged} visited={visited}
        onNavigate={navigate} onAnswer={setAnswer} onToggleFlag={toggleFlag}
        onMarkReview={id => setFlagged(prev => new Set(prev).add(id))}
        onNext={() => navigate(Math.min(total - 1, safeIdx + 1))}
        onSubmit={() => setMode("REVIEW")} submitLabel="Submit Quiz"
        tools={<button type="button" className={examStyles.tool} onClick={() => setCalcOpen(open => !open)} aria-expanded={calcOpen}>Calculator</button>}
        sections={isSectioned ? sections.map(section => (
          <button type="button" key={section.id} className={examStyles.sectionTab}
            aria-current={currentSectionId === section.id ? "true" : undefined}
            onClick={() => { const index = allQuestions.findIndex(item => item.section_id === section.id); if (index >= 0) navigate(index); }}>
            {section.title}
          </button>
        )) : undefined}
      />
      {calcOpen && <CalculatorWindow onClose={() => setCalcOpen(false)} />}
    </div>
  );
}
