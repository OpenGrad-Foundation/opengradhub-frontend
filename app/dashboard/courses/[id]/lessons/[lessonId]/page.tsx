"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getLessonById,
  getCourseById,
  patchLessonProgress,
  getQuizAttempts,
  type LessonDetail,
  type QuizAttempt,
} from "@/lib/api";
import type { RoleCode } from "@/lib/moduleAccess";

// ── YouTube IFrame API type declarations ───────────────────────
// (Minimal — only what we use. Avoids a third-party @types package.)

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

// ── Page ───────────────────────────────────────────────────────

export default function LessonPage() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const studentId = userData?.user?.id ?? "";
  const roleCode = (userData?.role?.code ?? "") as RoleCode;

  const [lesson, setLesson]           = useState<LessonDetail | null>(null);
  const [attempts, setAttempts]       = useState<QuizAttempt[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lockingMode, setLockingMode] = useState<string>("FREE");
  const [isComplete, setIsComplete]   = useState(false);

  // Progress tracking state
  const [watchedPct, setWatchedPct] = useState(0);
  const completionFiredRef = useRef(false);
  const playerRef          = useRef<YTPlayer | null>(null);
  const pollTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs so memoised callbacks always read the latest values without going stale
  const studentIdRef = useRef(studentId);
  const lessonIdRef  = useRef(lessonId as string);
  useEffect(() => { studentIdRef.current = studentId; }, [studentId]);
  useEffect(() => { lessonIdRef.current  = lessonId as string; }, [lessonId]);

  // ── Data load ─────────────────────────────────────────────────

  useEffect(() => {
    if (userLoading || !lessonId) return;
    setLoading(true);
    getLessonById(lessonId)
      .then(async (l) => {
        setLesson(l);
        // Initialise completion from the lesson payload if the API returns it
        if (l.is_complete) setIsComplete(true);
        const [course, quizAttempts] = await Promise.all([
          getCourseById(l.course_id).catch(() => null),
          l.module_quiz_id && studentId ? getQuizAttempts(l.module_quiz_id, studentId).catch(() => []) : Promise.resolve([]),
        ]);
        if (course) setLockingMode(course.locking_mode ?? "FREE");
        setAttempts(quizAttempts as QuizAttempt[]);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load lesson."))
      .finally(() => setLoading(false));
  }, [userLoading, lessonId, studentId]);

  // ── YouTube IFrame API ─────────────────────────────────────────

  const initPlayer = useCallback((videoId: string) => {
    // Destroy any previous player
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    }

    playerRef.current = new window.YT.Player("yt-player", {
      videoId,
      playerVars: {
        rel: 0,
        modestbranding: 1,
        origin: typeof window !== "undefined" ? window.location.origin : "",
      },
      events: {
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            startPoll();
          } else {
            stopPoll();
          }
          // Auto-submit at video end
          if (e.data === window.YT.PlayerState.ENDED) {
            recordProgress(100);
          }
        },
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!lesson?.video_id) return;

    if (window.YT?.Player) {
      // API already loaded
      initPlayer(lesson.video_id);
      return;
    }

    // Load the API script once
    if (!document.getElementById("yt-api-script")) {
      const script = document.createElement("script");
      script.id = "yt-api-script";
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }

    // Callback invoked by the API when ready
    window.onYouTubeIframeAPIReady = () => {
      if (lesson?.video_id) initPlayer(lesson.video_id);
    };

    return () => {
      stopPoll();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
    };
  }, [lesson?.video_id, initPlayer]);

  // ── Progress polling ───────────────────────────────────────────

  function startPoll() {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const duration = p.getDuration();
      if (!duration) return;
      const pct = Math.round((p.getCurrentTime() / duration) * 100);
      setWatchedPct(pct);
      recordProgress(pct);
    }, 5000);
  }

  function stopPoll() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function recordProgress(pct: number) {
    // Read from refs so this is safe to call from any stale closure
    const sid = studentIdRef.current;
    const lid = lessonIdRef.current;
    if (!sid || !lid) return;
    if (pct >= 80 && !completionFiredRef.current) {
      completionFiredRef.current = true;
    }
    patchLessonProgress({ student_id: sid, lesson_id: lid, watched_percent: pct })
      .then(result => { if (result.is_complete) setIsComplete(true); })
      .catch(() => { /* ignore */ });
  }

  // ── Render ─────────────────────────────────────────────────────

  if (loading || userLoading) return <LoadingState />;

  if (error || !lesson) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Error</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>{error ?? "Lesson not found."}</p>
        <Link href={`/dashboard/courses/${courseId}`} style={{ ...S.btn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
          ← Back to Course
        </Link>
      </div>
    );
  }

  // watchedPct drives re-renders; isComplete persists across renders and sessions
  const isUnlocked = isComplete || watchedPct >= 80;
  const isSequentialCourse = lockingMode === "SEQUENTIAL";
  const isStudent = roleCode === "STUDENT";
  // In sequential mode, students must complete this lesson before navigating to the next
  const nextLessonLocked = isStudent && isSequentialCourse && !isUnlocked;

  return (
    <div>
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "20px", fontSize: "13px" }}>
        <Link href="/dashboard/courses" style={{ color: "#209379", textDecoration: "none", fontWeight: 600 }}>My Courses</Link>
        <span style={{ color: "rgba(3,72,82,0.3)" }}>›</span>
        <Link href={`/dashboard/courses/${courseId}`} style={{ color: "#209379", textDecoration: "none", fontWeight: 600 }}>{lesson.course_title}</Link>
        <span style={{ color: "rgba(3,72,82,0.3)" }}>›</span>
        <span style={{ color: "rgba(3,72,82,0.55)" }}>{lesson.title}</span>
      </div>

      {/* ── Main layout: video + sidebar ───────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px", alignItems: "flex-start" }}>

        {/* ── Left: Video + notes ─────────────────────── */}
        <div>
          {/* 16:9 video container — src built from video_id only, never the raw URL */}
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: "16px", overflow: "hidden", background: "#000", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>
            {/* Force the iframe the YT API injects to fill the container.
                The API sets width="640" height="390" as HTML attributes; this CSS overrides them. */}
            <style>{`
              #yt-player,
              #yt-player iframe {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border: none;
              }
            `}</style>
            <div id="yt-player" />
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "rgba(3,72,82,0.1)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "2px",
                width: `${watchedPct}%`,
                background: isUnlocked ? "#0abe62" : "linear-gradient(90deg, #0abe62, #209379)",
                transition: "width 500ms ease",
              }} />
            </div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: isUnlocked ? "#0abe62" : "rgba(3,72,82,0.45)", whiteSpace: "nowrap" }}>
              {isUnlocked ? "✓ Complete" : `${watchedPct}% watched`}
            </span>
          </div>

          {/* ── Notes ──────────────────────────────────── */}
          {lesson.notes_html && (
            <div style={{ ...glassCard, marginTop: "20px" }}>
              <p style={{ ...S.sectionLabel, marginBottom: "14px" }}>Notes & Explanation</p>
              <div
                style={{ fontSize: "15px", color: "#034852", lineHeight: 1.8 }}
                // notes_html is sanitised at write time (manager input via admin form)
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.notes_html) }}
              />
            </div>
          )}
        </div>

        {/* ── Right: Lesson info + quiz ───────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Lesson info card */}
          <div style={glassCard}>
            <p style={S.sectionLabel}>Module</p>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "4px 0 14px" }}>{lesson.module_name}</p>

            <p style={{ ...S.heading, fontSize: "18px", margin: "0 0 10px", lineHeight: 1.3 }}>{lesson.title}</p>

            {lesson.duration_minutes && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "rgba(3,72,82,0.55)" }}>
                <span>⏱</span>
                <span>{lesson.duration_minutes} min</span>
              </div>
            )}
          </div>

          {/* Take Module Test */}
          {lesson.module_quiz_id && (
            <div style={glassCard}>
              <p style={S.sectionLabel}>Module Quiz</p>
              {isUnlocked ? (
                <>
                  <Link
                    href={`/dashboard/quiz/${lesson.module_quiz_id}`}
                    style={{
                      ...S.btn, display: "block", textAlign: "center",
                      textDecoration: "none", marginTop: "10px",
                    }}
                  >
                    Take Module Test →
                  </Link>
                  {/* Previous attempts */}
                  {attempts.length > 0 && (
                    <div style={{ marginTop: "14px" }}>
                      <p style={{ ...S.sectionLabel, marginBottom: "8px" }}>Previous Scores</p>
                      {attempts.slice(0, 5).map((a) => (
                        <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(3,72,82,0.06)", fontSize: "12px" }}>
                          <span style={{ color: "rgba(3,72,82,0.55)" }}>
                            Attempt {a.attempt_number}
                          </span>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {a.is_complete ? (
                              <>
                                <span style={{ fontWeight: 700, color: "#034852" }}>
                                  {a.score ?? "—"} / {a.max_score ?? "—"}
                                </span>
                                <span style={{
                                  padding: "2px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
                                  background: a.passed ? "rgba(10,190,98,0.12)" : "rgba(220,38,38,0.1)",
                                  color: a.passed ? "#0abe62" : "#dc2626",
                                }}>
                                  {a.passed ? "Pass" : "Fail"}
                                </span>
                              </>
                            ) : (
                              <span style={{ color: "rgba(3,72,82,0.4)" }}>In progress</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ marginTop: "10px" }}>
                  <div style={{
                    padding: "12px 14px", borderRadius: "10px",
                    background: "rgba(3,72,82,0.04)", border: "1px solid rgba(3,72,82,0.08)",
                    fontSize: "13px", color: "rgba(3,72,82,0.5)", textAlign: "center",
                  }}>
                    🔒 Watch 80% of this lesson to unlock the quiz
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prev / Next navigation */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lesson.prev_lesson_id && (
              <Link
                href={`/dashboard/courses/${courseId}/lessons/${lesson.prev_lesson_id}`}
                style={{ ...S.outlineBtn, display: "block", textAlign: "center", textDecoration: "none" }}
              >
                ← Previous Lesson
              </Link>
            )}
            {lesson.next_lesson_id && (
              nextLessonLocked ? (
                <div style={{
                  padding: "10px 14px", borderRadius: "10px",
                  background: "rgba(3,72,82,0.04)", border: "1px solid rgba(3,72,82,0.08)",
                  fontSize: "13px", color: "rgba(3,72,82,0.45)", textAlign: "center",
                  cursor: "not-allowed",
                }}>
                  🔒 Watch 80% to unlock Next Lesson
                </div>
              ) : (
                <Link
                  href={`/dashboard/courses/${courseId}/lessons/${lesson.next_lesson_id}`}
                  style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none" }}
                >
                  Next Lesson →
                </Link>
              )
            )}
            <Link
              href={`/dashboard/courses/${courseId}`}
              style={{ textAlign: "center", fontSize: "12px", color: "#209379", textDecoration: "none", fontWeight: 600, padding: "6px 0" }}
            >
              ↑ Back to Course Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * Basic HTML sanitiser — strips <script> blocks and dangerous event attributes.
 * notes_html is also sanitised at write time by admin input; this is a defence-in-depth layer.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function LoadingState() {
  return (
    <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching lesson…</p>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.7)", backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: "20px", padding: "22px 24px", boxShadow: "0 16px 40px rgba(0,0,0,0.07)",
};

const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379", margin: 0,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.2em", color: "rgba(3,72,82,0.5)", margin: 0,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852",
  } as React.CSSProperties,
  btn: {
    padding: "10px 18px", border: "none", borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
    fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)",
    transition: "all 200ms ease",
  } as React.CSSProperties,
  outlineBtn: {
    padding: "10px 18px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "10px",
    background: "transparent", color: "#034852", fontFamily: "var(--font-heading)",
    fontWeight: 700, fontSize: "13px", cursor: "pointer",
  } as React.CSSProperties,
};
