"use client";

import { useId, useState } from "react";
import type { AttemptReviewQuestion } from "@/lib/api";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import styles from "./question-review.module.css";

export const label: React.CSSProperties = { fontSize: "12px", fontWeight: 600, color: "#526761", margin: "0 0 6px" };

export function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const isYouTube = u.hostname === "www.youtube.com" || u.hostname === "youtube.com" || u.hostname === "youtu.be";
    if (!isYouTube) return null;
    const v = u.hostname === "youtu.be"
      ? u.pathname.slice(1)
      : u.searchParams.get("v");
    if (!v || !/^[a-zA-Z0-9_-]{11}$/.test(v)) return null;
    return `https://www.youtube.com/embed/${v}`;
  } catch {
    return null;
  }
}


export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function QuestionAnalyticsPanel({ q }: { q: AttemptReviewQuestion }) {
  const manual = q.question_type === "FILL" || q.question_type === "ESSAY";
  return <dl className={styles.analytics} aria-label="Question statistics">
    <div><dt>Your time</dt><dd>{q.time_taken_seconds != null ? formatSeconds(q.time_taken_seconds) : "—"}</dd></div>
    <div><dt>Batch average</dt><dd>{q.avg_time_seconds != null ? formatSeconds(q.avg_time_seconds) : "—"}</dd></div>
    <div><dt>Correct in batch</dt><dd>{manual ? "Manual grading" : q.batch_total_count > 0
      ? `${q.batch_correct_count}/${q.batch_total_count} (${Math.round(q.batch_correct_count / q.batch_total_count * 100)}%)` : "—"}</dd></div>
  </dl>;
}

export function PassageCard({ html, imageUrl, instructionHtml }: { html: string; imageUrl: string | null; instructionHtml: string | null }) {
  return <section className={styles.passageCard} aria-label="Reading passage">
    <h3>Reading passage</h3>
    {instructionHtml?.trim() && <MathContent html={instructionHtml} className={styles.prose} />}
    <MathContent html={html} className={styles.prose} />
    {imageUrl && <img src={imageUrl} alt="Passage image" className={styles.image} />}
  </section>;
}

export function QuestionReviewCard({ q, idx, revealed = false, questionLabel, reportButton, showAnalytics = true, allowRetry = false }: {
  q: AttemptReviewQuestion; idx: number; revealed?: boolean; questionLabel?: string;
  reportButton?: React.ReactNode;
  /** A preview has no real timing or cohort data. */
  showAnalytics?: boolean;
  allowRetry?: boolean;
}) {
  const [localRevealed, setLocalRevealed] = useState(false);
  const [retryAnswer, setRetryAnswer] = useState<string | null>(null);
  const answerId = useId();
  const answerVisible = allowRetry ? localRevealed : revealed;
  const retrying = allowRetry && !answerVisible;
  const displayedAnswer = allowRetry ? retryAnswer : q.student_answer;
  const status = q.student_answer == null ? "skipped" : q.is_correct === true ? "correct" : q.is_correct === false ? "wrong" : "pending";
  const statusLabel = { skipped: "Skipped", correct: "Correct", wrong: "Incorrect", pending: "Pending review" }[status];
  const embedUrl = q.explanation_video_url ? getYouTubeEmbedUrl(q.explanation_video_url) : null;
  const hasPassage = !!q.instruction_html?.trim();
  return <article className={styles.question}>
    <header className={styles.header}>
      <h3>{questionLabel ?? `Question ${idx + 1}`}</h3>
      <div className={styles.statusTools}>
        {reportButton}
        {answerVisible && <span className={styles[status]}>{allowRetry ? `Submitted: ${statusLabel}` : statusLabel}</span>}
      </div>
    </header>
    <div className={hasPassage ? styles.split : styles.body}>
      {hasPassage && <section className={styles.passage} aria-label="Passage and instructions">
        <MathContent html={q.instruction_html!} className={styles.prose} />
      </section>}
      <div className={styles.answerPane} id={answerId}>
        <MathContent html={q.content_html} className={styles.prompt} />
        {q.image_url && <img src={q.image_url} alt="Question image" className={styles.image} />}
        {q.question_type === "MCQ" && q.options.length > 0 && <ol className={styles.options} role={retrying ? "radiogroup" : undefined} aria-label="Answer options">
          {q.options.map((opt, optionIndex) => {
            const selected = displayedAnswer === opt.id;
            const correct = answerVisible && opt.is_correct;
            const wrong = answerVisible && selected && !opt.is_correct;
            const Option = retrying ? "button" : "div";
            return <li key={opt.id} className={styles.optionItem}>
              <Option className={styles.option} data-result={correct ? "correct" : wrong ? "wrong" : selected ? "selected" : undefined}
                type={retrying ? "button" : undefined} role={retrying ? "radio" : undefined}
                aria-checked={retrying ? selected : undefined}
                tabIndex={retrying ? selected || (retryAnswer == null && optionIndex === 0) ? 0 : -1 : undefined}
                onClick={retrying ? () => setRetryAnswer(opt.id) : undefined}
                onKeyDown={retrying ? event => {
                  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
                  event.preventDefault();
                  const index = (optionIndex + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + q.options.length) % q.options.length;
                  setRetryAnswer(q.options[index].id);
                  event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
                } : undefined}>
                <span className={styles.optionLetter} aria-hidden="true">{String.fromCharCode(65 + optionIndex)}.</span>
                <span className={styles.optionContent}>
                  <MathContent inline html={opt.option_text} />
                  {(selected || correct) && <span className={styles.optionNote}>
                    {selected && correct ? `${allowRetry ? "Your retry" : "Your answer"} · correct` : selected ? allowRetry ? "Your retry" : "Your answer" : "Correct answer"}
                  </span>}
                  {allowRetry && answerVisible && q.student_answer === opt.id && <span className={styles.optionNote}>Submitted answer</span>}
                </span>
              </Option>
            </li>;
          })}
        </ol>}
        {["FILL", "NUMERICAL", "ESSAY"].includes(q.question_type) && (retrying ? (
          <label className={styles.retryField}>Try your answer
            {q.question_type === "ESSAY" ? <textarea value={retryAnswer ?? ""} onChange={event => setRetryAnswer(event.target.value)} rows={5} />
              : <input type={q.question_type === "NUMERICAL" ? "number" : "text"} value={retryAnswer ?? ""} onChange={event => setRetryAnswer(event.target.value)} />}
          </label>
        ) : <dl className={styles.writtenAnswer}>
          {allowRetry && <div><dt>Your retry</dt><dd>{retryAnswer || "—"}</dd></div>}
          <div><dt>{allowRetry ? "Submitted answer" : "Your answer"}</dt><dd>{q.student_answer ?? "—"}</dd></div>
          {answerVisible && <div><dt>Correct answer</dt><dd>{q.correct_answer ? <MathContent html={q.correct_answer} /> : "—"}</dd></div>}
        </dl>)}
        {allowRetry && <div className={styles.retryActions}>
          <button type="button" className={styles.answerToggle} aria-expanded={answerVisible} aria-controls={answerId}
            onClick={() => setLocalRevealed(value => !value)}>{answerVisible ? "Hide answer" : "View answer"}</button>
          <p className={styles.retryNote}>Practice only. Your submitted answer and score stay unchanged.</p>
        </div>}
        {answerVisible && q.solution_html && <section className={styles.solution}>
          <h4>Solution</h4><MathContent html={q.solution_html} className={styles.prose} />
        </section>}
        {answerVisible && embedUrl && <section className={styles.solution}>
          <h4>Explanation</h4><iframe className={styles.video} title={`Explanation for ${questionLabel ?? `question ${idx + 1}`}`} src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </section>}
      </div>
    </div>
    {showAnalytics && (!allowRetry || answerVisible) && <QuestionAnalyticsPanel q={q} />}
  </article>;
}
