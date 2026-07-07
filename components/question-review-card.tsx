import type { AttemptReviewQuestion } from "@/lib/api";
import { MathContent } from "@/app/dashboard/_components/MathContent";

// ── Styles ────────────────────────────────────────────────────────────────────

export const card: React.CSSProperties = { background: "rgba(255,255,255,0.85)", borderRadius: "16px", padding: "28px 32px", boxShadow: "0 2px 24px rgba(3,72,82,0.08)", marginBottom: "20px" };
export const label: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: "0 0 4px" };

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

// ── Single question card ──────────────────────────────────────────────────────

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function QuestionAnalyticsPanel({ q }: { q: AttemptReviewQuestion }) {
  const isManualGrading = q.question_type === "FILL" || q.question_type === "ESSAY";
  const correctPct = !isManualGrading && q.batch_total_count > 0
    ? Math.round((q.batch_correct_count / q.batch_total_count) * 100)
    : null;

  return (
    <div 
      className="w-full sm:w-[200px] shrink-0 flex flex-col gap-[14px] p-4 rounded-xl"
      style={{
        background: "rgba(3,72,82,0.03)",
        border: "1.5px solid rgba(3,72,82,0.09)",
      }}
    >
      <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "#209379" }}>Analytics</p>

      {/* My time */}
      <div>
        <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>My Time</p>
        <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#034852" }}>
          {q.time_taken_seconds != null ? formatSeconds(q.time_taken_seconds) : "—"}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(3,72,82,0.08)" }} />

      {/* Avg time */}
      <div>
        <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Avg Time (Batch)</p>
        <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#034852" }}>
          {q.avg_time_seconds != null ? formatSeconds(q.avg_time_seconds) : "—"}
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "rgba(3,72,82,0.08)" }} />

      {/* Batch correct — hidden for FILL (manual grading, is_correct never set) */}
      {isManualGrading ? (
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Correct in Batch</p>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.35)", fontStyle: "italic" }}>Manual grading</p>
        </div>
      ) : (
        <div>
          <p style={{ margin: "0 0 2px", fontSize: "10px", fontWeight: 600, color: "rgba(3,72,82,0.45)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Correct in Batch</p>
          <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0abe62" }}>
            {q.batch_total_count > 0 ? `${q.batch_correct_count}/${q.batch_total_count}` : "—"}
          </p>
          {correctPct !== null && (
            <p style={{ margin: "2px 0 0", fontSize: "12px", fontWeight: 600, color: "rgba(3,72,82,0.4)" }}>{correctPct}% got it right</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PassageCard({ html, imageUrl }: { html: string; imageUrl: string | null }) {
  return (
    <div style={{
      ...card,
      background: "rgba(3,72,82,0.02)",
      border: "1.5px solid rgba(3,72,82,0.1)",
      marginBottom: "8px",
    }}>
      <p style={{ ...label, marginBottom: "10px" }}>Reading Passage</p>
      <MathContent html={html} style={{ fontSize: "15px", lineHeight: 1.7, color: "#034852" }} />
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Passage image"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid rgba(3,72,82,0.1)", display: "block", marginTop: "14px" }}
        />
      )}
    </div>
  );
}

export function QuestionReviewCard({ q, idx, revealed, questionLabel }: { q: AttemptReviewQuestion; idx: number; revealed: boolean; questionLabel?: string }) {
  const borderColor =
    q.is_correct === true  ? "#0abe62" :
    q.is_correct === false ? "#e53e3e" :
    "rgba(3,72,82,0.12)";

  const statusLabel =
    q.student_answer == null         ? "Skipped" :
    q.is_correct === true            ? "Correct" :
    q.is_correct === false           ? "Wrong"   :
    "Pending";

  const statusColor =
    q.is_correct === true  ? "#0abe62" :
    q.is_correct === false ? "#e53e3e" :
    "rgba(3,72,82,0.4)";

  const statusBg =
    q.is_correct === true  ? "rgba(10,190,98,0.09)" :
    q.is_correct === false ? "rgba(229,62,62,0.09)" :
    "rgba(3,72,82,0.07)";

  const embedUrl = q.explanation_video_url ? getYouTubeEmbedUrl(q.explanation_video_url) : null;

  return (
    <div style={{ ...card, border: `2px solid ${borderColor}`, marginBottom: "16px", padding: "0" }}>
      <div className="flex flex-col lg:flex-row items-stretch">
        {/* Left: question content */}
        <div className="flex-1 min-w-0 p-5 sm:p-6 lg:p-7">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "8px" }}>
            <p style={{ ...label, margin: 0 }}>{questionLabel ?? `Q${idx + 1}`}</p>
            <span style={{ fontSize: "11px", fontWeight: 700, color: statusColor, padding: "2px 8px", borderRadius: "100px", background: statusBg, flexShrink: 0 }}>
              {statusLabel}
            </span>
          </div>

          <MathContent html={q.content_html} style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.5, marginBottom: q.image_url ? "10px" : "14px" }} />

          {q.image_url && (
            <div style={{ marginBottom: "14px" }}>
              <img
                src={q.image_url}
                alt="Question image"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                style={{ maxWidth: "100%", borderRadius: "8px", border: "1px solid rgba(3,72,82,0.1)", display: "block" }}
              />
            </div>
          )}

          {/* MCQ options */}
          {q.question_type === "MCQ" && q.options.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
              {q.options.map((opt) => {
                const isStudentAnswer = q.student_answer === opt.id;
                const isCorrect = opt.is_correct;
                // Correct answer only shows once revealed.
                const showCorrect      = revealed && isCorrect;
                const showStudentWrong = revealed && isStudentAnswer && !isCorrect;

                const bg =
                  showCorrect      ? "rgba(10,190,98,0.12)" :
                  showStudentWrong ? "rgba(229,62,62,0.08)" :
                  isStudentAnswer  ? "rgba(3,72,82,0.06)" :
                  "rgba(3,72,82,0.03)";
                const border =
                  showCorrect      ? "#0abe62" :
                  showStudentWrong ? "#e53e3e" :
                  isStudentAnswer  ? "rgba(3,72,82,0.2)" :
                  "rgba(3,72,82,0.08)";
                const dot =
                  showCorrect      ? "#0abe62" :
                  showStudentWrong ? "#e53e3e" :
                  isStudentAnswer  ? "#209379" :
                  "rgba(3,72,82,0.25)";
                const fillRadio = isStudentAnswer || showCorrect;

                return (
                  <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 14px", borderRadius: "8px", background: bg, border: `1.5px solid ${border}` }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${dot}`, background: "#fff", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {fillRadio && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: dot }} />}
                    </span>
                    <MathContent inline html={opt.option_text} style={{ fontSize: "14px", color: "#034852" }} />
                    <span style={{ marginLeft: "auto", display: "flex", gap: "8px", flexShrink: 0 }}>
                      {isStudentAnswer && (
                        <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>Your answer</span>
                      )}
                      {showCorrect && (
                        <span style={{ fontSize: "11px", color: "#0abe62" }}>Correct</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* FILL / NUMERICAL / ESSAY */}
          {(q.question_type === "FILL" || q.question_type === "NUMERICAL" || q.question_type === "ESSAY") && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px" }}>
              <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(3,72,82,0.04)", border: "1px solid rgba(3,72,82,0.1)", flex: 1, minWidth: "250px" }}>
                <p style={{ margin: 0, fontSize: "11px", color: "rgba(3,72,82,0.5)", fontWeight: 600 }}>Your answer</p>
                <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: 700, color: q.is_correct === false ? "#e53e3e" : "#034852", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {q.student_answer ?? "—"}
                </p>
              </div>
              {revealed && (
                <div style={{ padding: "8px 14px", borderRadius: "8px", background: "rgba(10,190,98,0.07)", border: "1px solid rgba(10,190,98,0.2)" }}>
                  <p style={{ margin: 0, fontSize: "11px", color: "#0abe62", fontWeight: 600 }}>Correct answer</p>
                  <p style={{ margin: "2px 0 0", fontSize: "14px", fontWeight: 700, color: "#034852" }}>
                    {q.correct_answer ? <MathContent inline html={q.correct_answer} /> : "—"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Explanation video */}
          {revealed && embedUrl && (
            <div style={{ marginTop: "16px" }}>
              <p style={{ ...label, color: "#034852", marginBottom: "8px" }}>Explanation</p>
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "10px", overflow: "hidden" }}>
                <iframe
                  src={embedUrl}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Solution Text */}
          {revealed && q.solution_html && (
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(10,190,98,0.05)", borderRadius: "8px", border: "1px solid rgba(10,190,98,0.2)" }}>
              <p style={{ ...label, color: "#0abe62", marginBottom: "8px" }}>Solution</p>
              <MathContent html={q.solution_html} style={{ fontSize: "14px", lineHeight: 1.6, color: "#034852" }} />
            </div>
          )}
        </div>

        {/* Right: analytics panel */}
        <div 
          className="p-5 lg:p-6 flex items-start border-t-[1.5px] lg:border-t-0 lg:border-l-[1.5px]" 
          style={{ borderColor: `${borderColor}30` }}
        >
          <QuestionAnalyticsPanel q={q} />
        </div>
      </div>
    </div>
  );
}
