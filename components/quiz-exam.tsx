"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { QuizAttemptQuestion } from "@/lib/api";
import { QuestionView, type AnswerMap } from "@/components/question-view";
import styles from "./quiz-exam.module.css";

const statusLabels = {
  answered: "Answered",
  unanswered: "Not answered",
  unvisited: "Not visited",
  review: "Marked for review",
  reviewedAnswer: "Answered & marked for review",
};
type Status = keyof typeof statusLabels;

function questionStatus(q: QuizAttemptQuestion, answers: AnswerMap, flagged: Set<string>, visited: Set<string>): Status {
  const answered = (answers[q.snapshot_id] ?? "").trim() !== "";
  if (flagged.has(q.snapshot_id)) return answered ? "reviewedAnswer" : "review";
  if (answered) return "answered";
  return visited.has(q.snapshot_id) || answers[q.snapshot_id] != null ? "unanswered" : "unvisited";
}

export function QuizExam({
  title, badge, timer, timerLabel = "Time left", timerIsLow = false, sections, questions,
  currentIdx, answers, flagged, visited, onNavigate, onAnswer, onToggleFlag, onMarkReview,
  onNext, nextLabel, onSubmit, submitLabel, busy = false, renderReportButton, tools, notice,
}: {
  title: string; badge: string; timer: string; timerLabel?: string; timerIsLow?: boolean;
  sections?: ReactNode; questions: QuizAttemptQuestion[]; currentIdx: number;
  answers: AnswerMap; flagged: Set<string>; visited: Set<string>;
  onNavigate: (index: number) => void; onAnswer: (id: string, answer: string | null) => void;
  onToggleFlag: (id: string) => void; onMarkReview: (id: string) => void;
  onNext: () => void; nextLabel?: string; onSubmit: () => void; submitLabel: string;
  busy?: boolean; renderReportButton?: (id: string) => ReactNode; tools?: ReactNode; notice?: ReactNode;
}) {
  const q = questions[currentIdx];
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteId = useId();
  const paletteToggleRef = useRef<HTMLButtonElement>(null);
  const closePalette = () => {
    setPaletteOpen(false);
    paletteToggleRef.current?.focus();
  };
  const headingRef = useRef<HTMLDivElement>(null);
  const questionId = q?.snapshot_id;
  const previousQuestion = useRef(questionId);
  useEffect(() => {
    if (previousQuestion.current === questionId) return;
    previousQuestion.current = questionId;
    headingRef.current?.scrollIntoView?.({ block: "start" });
  }, [questionId]);
  if (!q) return null;
  // Include the currently displayed question immediately, before visit persistence runs.
  const seen = new Set(visited).add(q.snapshot_id);
  const statuses = questions.map(item => questionStatus(item, answers, flagged, seen));
  const last = currentIdx === questions.length - 1;
  // Numbering, palette and counts cover the current section only, so every section starts at 1.
  // Unsectioned quizzes (and sequential ones, which only hold one section) keep every question.
  const sectionIdxs = questions.flatMap((item, i) => (item.section_id ?? null) === (q.section_id ?? null) ? [i] : []);
  const count = (status: Status) => sectionIdxs.filter(i => statuses[i] === status).length;
  const clear = () => onAnswer(q.snapshot_id, null);

  return (
    <div className={styles.exam} data-palette-open={paletteOpen} onKeyDown={event => {
      if (event.key === "Escape" && paletteOpen) { event.preventDefault(); closePalette(); }
    }}>
      {notice}
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.brand}>OpenGrad<span>Hub</span></span>
          <h1>{title}</h1>
          <span className={styles.badge}>{badge}</span>
        </div>
        <div className={styles.timer} data-low={timerIsLow} role="timer" aria-label={`${timerLabel}: ${timer}`}>
          <span>{timerLabel}</span><strong>{timer}</strong>
        </div>
      </header>
      <div className={styles.navigationBar}>
        <div className={styles.sections}>{sections ?? <span className={styles.sectionLabel}>All questions</span>}</div>
        <button type="button" ref={paletteToggleRef} className={styles.paletteToggle} aria-expanded={paletteOpen} aria-controls={paletteId}
          onClick={() => setPaletteOpen(open => !open)}>{paletteOpen ? "Back to question" : "Questions"}</button>
      </div>
      <div className={styles.workspace}>
        <main className={styles.main}>
          <div className={styles.questionHeader} ref={headingRef}>
            <h2>Question {sectionIdxs.indexOf(currentIdx) + 1} <span>of {sectionIdxs.length}</span></h2>
            <div className={styles.questionTools}>
              {renderReportButton?.(q.snapshot_id)}
              <button type="button" className={styles.reviewToggle} aria-pressed={flagged.has(q.snapshot_id)} onClick={() => onToggleFlag(q.snapshot_id)}>
                {flagged.has(q.snapshot_id) ? "Unmark review" : "Mark for review"}
              </button>
            </div>
          </div>
          <div className={styles.questionBody} key={q.snapshot_id}>
            <QuestionView q={q} answers={answers} setAnswer={onAnswer} renderReportButton={renderReportButton} exam />
          </div>
          <footer className={styles.actions}>
            <div className={styles.actionGroup}>
              <button type="button" className={styles.reviewAction} disabled={busy} onClick={() => { onMarkReview(q.snapshot_id); if (!last) onNavigate(currentIdx + 1); }}>Mark for Review &amp; Next</button>
              <button type="button" className={styles.secondary} disabled={busy} onClick={clear}>Clear Response</button>
            </div>
            <div className={styles.actionGroup}>
              <button type="button" className={styles.secondary} disabled={currentIdx === 0 || busy} onClick={() => onNavigate(currentIdx - 1)}>Previous</button>
              <button type="button" className={styles.primary} disabled={busy} onClick={last ? onSubmit : onNext}>{last ? submitLabel : nextLabel ?? "Save & Next"}</button>
            </div>
          </footer>
        </main>
        <aside className={styles.sidebar} id={paletteId} aria-label="Question navigation">
          <div className={styles.sidebarTitle}><h2>Question palette</h2><span>{sectionIdxs.length} total</span></div>
          <div className={styles.legend}>
            {(Object.entries(statusLabels) as [Status, string][]).map(([status, label]) => (
              <div key={status} className={styles.legendItem}>
                <span className={`${styles.marker} ${styles[status]}`}>{count(status)}{status === "reviewedAnswer" && <i aria-hidden="true">✓</i>}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className={styles.paletteArea}>
            <p>Choose a question</p>
            <div className={styles.palette}>
              {sectionIdxs.map((i, n) => (
                <button type="button" key={questions[i].snapshot_id} className={`${styles.marker} ${styles[statuses[i]]}`}
                  aria-label={`Question ${n + 1}: ${statusLabels[statuses[i]]}`} aria-current={i === currentIdx ? "step" : undefined}
                  onClick={() => { onNavigate(i); if (paletteOpen) closePalette(); }} disabled={busy}>
                  {n + 1}{statuses[i] === "reviewedAnswer" && <i aria-hidden="true">✓</i>}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.sidebarActions}>
            {tools}
            <button type="button" className={styles.submit} disabled={busy} onClick={onSubmit}>{submitLabel}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
