"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Sentry from "@sentry/nextjs";
import { sanitize as sanitizeHtml } from "@/lib/purify";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { useParams, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getLessonById,
  getCourseById,
  patchLessonProgress,
  getQuizAttempts,
  type LessonDetail,
  type QuizAttempt,
} from "@/lib/api";
import { qk } from "@/lib/queries/keys";
import type { RoleCode } from "@/lib/moduleAccess";
import { getBackHref, withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";

// ── YouTube IFrame API type declarations ───────────────────────
// (Minimal — only what we use. Avoids a third-party @types package.)

declare global {
  interface Window {
    YT: {
      Player: new (
        element: string | HTMLElement,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
            onError?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
    __openGradYoutubeIframeApiPromise?: Promise<void>;
  }
}

interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

const YT_API_SCRIPT_ID = "yt-api-script";
const YT_API_READY_TIMEOUT_MS = 15000;
const YT_PLAYER_DIV_ID = "yt-player-root";

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube iframe API can only load in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (window.__openGradYoutubeIframeApiPromise) {
    return window.__openGradYoutubeIframeApiPromise;
  }

  window.__openGradYoutubeIframeApiPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let timeoutTimer: number | null = null;
    const handleError = () => fail();
    const existingScript = document.getElementById(YT_API_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    const cleanup = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      script.removeEventListener("error", handleError);
    };

    const finish = () => {
      if (settled || !window.YT?.Player) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      window.__openGradYoutubeIframeApiPromise = undefined;
      reject(new Error("YouTube iframe API failed to load."));
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      finish();
    };

    if (!existingScript) {
      script.id = YT_API_SCRIPT_ID;
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("error", handleError, { once: true });
    pollTimer = window.setInterval(finish, 250);
    timeoutTimer = window.setTimeout(fail, YT_API_READY_TIMEOUT_MS);
  });

  return window.__openGradYoutubeIframeApiPromise;
}

// ── Page ───────────────────────────────────────────────────────

export default function LessonPage() {
  const { id: courseId, lessonId } = useParams<{ id: string; lessonId: string }>();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();
  const currentUrl = useCurrentUrl();
  const from = useSearchParams().get("from");
  // Sibling-lesson nav re-attaches the original origin so BackLink keeps working.
  const carryFrom = (href: string) => (from ? `${href}?from=${encodeURIComponent(from)}` : href);
  const studentId = userData?.user?.id ?? "";
  const roleCode = (userData?.role?.code ?? "") as RoleCode;

  const [lesson, setLesson]           = useState<LessonDetail | null>(null);
  const [attemptsByQuiz, setAttemptsByQuiz] = useState<Record<string, QuizAttempt[]>>({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lockingMode, setLockingMode] = useState<string>("FREE");
  const [isComplete, setIsComplete]   = useState(false);

  // Progress tracking state
  const [watchedPct, setWatchedPct]   = useState(0);
  const [playerError, setPlayerError] = useState<number | null>(null);
  const [playerFrameNonce, setPlayerFrameNonce] = useState(0);
  const completionFiredRef   = useRef(false);
  const coursesInvalidatedRef = useRef(false);
  const nextPrefetchedRef     = useRef(false);
  const playerRef            = useRef<YTPlayer | null>(null);
  const pollTimerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const reinitAttemptsRef    = useRef(0);
  const playerInitTokenRef   = useRef(0);
  const videoIdRef           = useRef<string>("");

  // Refs so memoised callbacks always read the latest values without going stale
  const studentIdRef = useRef(studentId);
  const lessonIdRef  = useRef(lessonId as string);
  useEffect(() => { studentIdRef.current = studentId; }, [studentId]);
  useEffect(() => {
    lessonIdRef.current = lessonId as string;
    coursesInvalidatedRef.current = false;
    nextPrefetchedRef.current = false;
  }, [lessonId]);

  // ── Data load ─────────────────────────────────────────────────

  useEffect(() => {
    if (userLoading || !lessonId) return;
    let cancelled = false;

    async function loadLesson() {
      setLoading(true);
      setError(null);

      try {
        // Read through the query cache so a prefetched next-lesson (see the
        // prefetch effect below) is served instantly instead of re-fetched.
        const l = await queryClient.fetchQuery({
          queryKey: qk.lesson(lessonId),
          queryFn: () => getLessonById(lessonId),
          staleTime: 60 * 60_000,
        });
        if (cancelled) return;

        setLesson(l);
        setIsComplete(Boolean(l.is_complete));
        setWatchedPct(l.watched_percent ?? 0);
        completionFiredRef.current = Boolean(l.is_complete);

        const quizIds = l.module_quiz_ids ?? [];
        const [course, ...attemptLists] = await Promise.all([
          getCourseById(l.course_id).catch(() => null),
          ...quizIds.map((qid) =>
            studentId ? getQuizAttempts(qid, studentId).catch(() => []) : Promise.resolve([]),
          ),
        ]);

        if (cancelled) return;
        if (course) setLockingMode(course.locking_mode ?? "FREE");
        const map: Record<string, QuizAttempt[]> = {};
        quizIds.forEach((qid, i) => {
          map[qid] = (attemptLists[i] ?? []) as QuizAttempt[];
        });
        setAttemptsByQuiz(map);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load lesson.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLesson();
    return () => { cancelled = true; };
  }, [userLoading, lessonId, studentId, queryClient]);

  // ── YouTube IFrame API ─────────────────────────────────────────

  const recordProgress = useCallback((pct: number) => {
    const sid = studentIdRef.current;
    const lid = lessonIdRef.current;
    if (!sid || !lid) return;
    if (pct >= 80 && !completionFiredRef.current) {
      completionFiredRef.current = true;
    }
    patchLessonProgress({ student_id: sid, lesson_id: lid, watched_percent: pct })
      .then(result => {
        if (result.is_complete) {
          setIsComplete(true);
          if (!coursesInvalidatedRef.current) {
            coursesInvalidatedRef.current = true;
            void queryClient.invalidateQueries({ queryKey: qk.studentCourses(sid) });
          }
        }
      })
      .catch(() => { /* ignore */ });
  }, [queryClient]);

  const stopPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p || p.getPlayerState() !== (window.YT?.PlayerState.PLAYING ?? 1)) return;
      const duration = p.getDuration();
      if (!duration) return;
      const pct = Math.round((p.getCurrentTime() / duration) * 100);
      setWatchedPct(pct);
      recordProgress(pct);
    }, 5000);
  }, [recordProgress]);

  const destroyPlayer = useCallback(() => {
    stopPoll();
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* ignore */ }
      playerRef.current = null;
    }
  }, [stopPoll]);

  // YouTube IFrame API

  const initPlayer = useCallback(async (videoId: string) => {
    const initToken = ++playerInitTokenRef.current;
    videoIdRef.current = videoId;
    setPlayerError(null);

    try {
      await ensureYouTubeIframeApi();
    } catch (loadError) {
      if (playerInitTokenRef.current !== initToken) return;
      console.error("[YT Player] API load failed:", loadError);
      setPlayerError(-1);
      return;
    }

    if (playerInitTokenRef.current !== initToken) return;

    // The stable wrapper must exist before we do anything.
    const wrapper = document.getElementById("yt-player-wrapper");
    if (!wrapper) return;

    // player.destroy() completely removes its <iframe> from the DOM — React
    // never sees the deletion, so it doesn't recreate the child div.
    // We must manually rebuild a fresh div before every YT.Player() call.
    let mountDiv = document.getElementById(YT_PLAYER_DIV_ID);
    if (mountDiv) mountDiv.remove();
    mountDiv = document.createElement("div");
    mountDiv.id = YT_PLAYER_DIV_ID;
    wrapper.appendChild(mountDiv);

    playerRef.current = new window.YT.Player(mountDiv, {
      videoId,
      playerVars: {
        enablejsapi: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      } as Record<string, string | number>,
      events: {
        onReady: () => {
          if (playerInitTokenRef.current !== initToken) return;
          reinitAttemptsRef.current = 0;
          setPlayerError(null);
        },
        onStateChange: (e) => {
          if (playerInitTokenRef.current !== initToken) return;
          if (e.data === window.YT.PlayerState.PLAYING) {
            startPoll();
          } else {
            stopPoll();
          }
          if (e.data === window.YT.PlayerState.ENDED) {
            // recordProgress() only calls the API — it never updates watchedPct.
            // setWatchedPct(100) here fills the bar visually to 100%.
            setWatchedPct(100);
            recordProgress(100);
          }
        },
        onError: (e) => {
          if (playerInitTokenRef.current !== initToken) return;

          // YT error codes:
          //   2   — invalid videoId param
          //   5   — HTML5 player error (transient)
          //   100 — video not found / private
          //   101 — embed disabled by video owner
          //   150 — same as 101 (different host)
          // 100/101/150/2 are permanent. Retry only helps for 5.
          const permanent = e.data === 2 || e.data === 100 || e.data === 101 || e.data === 150;
          if (permanent) {
            destroyPlayer();
            setPlayerError(e.data);
            return;
          }

          reinitAttemptsRef.current += 1;
          if (reinitAttemptsRef.current >= 3) {
            destroyPlayer();
            setPlayerError(e.data);
            return;
          }

          setPlayerFrameNonce((count) => count + 1);
        },
      },
    });
  }, [destroyPlayer, recordProgress, startPoll, stopPoll]);

  useEffect(() => {
    // Guard: only init when lesson is fully loaded and the wrapper is in the DOM.
    // Without this, initPlayer runs while loading=true and the wrapper isn't
    // mounted yet, so YT.Player silently fails (black screen / race condition).
    if (!lesson?.video_id || loading) return;

    reinitAttemptsRef.current = 0;

    const initTimer = window.setTimeout(() => {
      void initPlayer(lesson.video_id);
    }, 0);

    return () => {
      window.clearTimeout(initTimer);
      playerInitTokenRef.current += 1;
      destroyPlayer();
    };
  }, [destroyPlayer, initPlayer, lesson?.video_id, loading, playerFrameNonce]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        stopPoll();
        return;
      }

      const p = playerRef.current;
      if (p && p.getPlayerState() === (window.YT?.PlayerState.PLAYING ?? 1)) {
        startPoll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [startPoll, stopPoll]);

  // L6 — prefetch the next lesson once the student is far enough along that
  // navigation is imminent. In sequential courses the next lesson is locked
  // until this one is 80% watched, so don't prefetch a lesson that would 403.
  // Fire-once per lesson; the ref resets when lessonId changes.
  useEffect(() => {
    if (nextPrefetchedRef.current) return;
    const nextId = lesson?.next_lesson_id;
    if (!nextId || watchedPct < 60) return;
    const unlocked = isComplete || watchedPct >= 80;
    const crossBlocked = Boolean(lesson.next_in_new_module) && !lesson.current_module_complete;
    const seqLocked = roleCode === "STUDENT" && lockingMode === "SEQUENTIAL" && (!unlocked || crossBlocked);
    if (seqLocked) return;
    nextPrefetchedRef.current = true;
    void queryClient.prefetchQuery({
      queryKey: qk.lesson(nextId),
      queryFn: () => getLessonById(nextId),
      staleTime: 60 * 60_000,
    });
  }, [lesson, watchedPct, isComplete, lockingMode, roleCode, queryClient]);

  if (loading || userLoading) return <LoadingState />;

  if (error || !lesson) {
    return (
      <div style={glassCard}>
        <p style={S.label}>Error</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>{error ?? "Lesson not found."}</p>
        <BackLink fallback={`/dashboard/courses/${courseId}`} style={{ ...S.btn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
          ← Back to Course
        </BackLink>
      </div>
    );
  }

  // watchedPct drives re-renders; isComplete persists across renders and sessions
  const isUnlocked = isComplete || watchedPct >= 80;
  const isSequentialCourse = lockingMode === "SEQUENTIAL";
  const isStudent = roleCode === "STUDENT";
  // Non-students view lessons as a read-only preview (no quiz-taking, no gating).
  const isPreview = !isStudent;
  // In sequential mode, students must complete this lesson before navigating to the
  // next; AND if the next lesson starts a new module, the current module must be
  // fully complete (all lessons + all module quizzes passed) to cross over.
  const crossModuleBlocked =
    isStudent && isSequentialCourse && Boolean(lesson.next_in_new_module) && !lesson.current_module_complete;
  const nextLessonLocked = isStudent && isSequentialCourse && (!isUnlocked || crossModuleBlocked);
  // Module test gate (sequential): EVERY lesson in the module must be complete,
  // not just this one. Other lessons come from the server; this lesson uses the
  // live watched% so finishing the last video unlocks the test without a refetch.
  // Strict === false: a cached pre-upgrade payload without the field falls back
  // to the old 80% gate — the backend still blocks the attempt either way.
  const quizBlockedByOtherLessons =
    isStudent && isSequentialCourse && lesson.module_other_lessons_complete === false;

  return (
    <div>
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginBottom: "20px", fontSize: "13px" }}>
        <Link href="/dashboard/courses" style={{ color: "#209379", textDecoration: "none", fontWeight: 600 }}>{isPreview ? "Courses" : "My Courses"}</Link>
        <span style={{ color: "rgba(3,72,82,0.3)" }}>›</span>
        <BackLink fallback={`/dashboard/courses/${courseId}`} style={{ color: "#209379", textDecoration: "none", fontWeight: 600 }}>{lesson.course_title}</BackLink>
        <span style={{ color: "rgba(3,72,82,0.3)" }}>›</span>
        <span style={{ color: "rgba(3,72,82,0.55)" }}>{lesson.title}</span>
      </div>

      {/* ── Main layout: video + sidebar ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

        {/* ── Mobile: Header (Top) | Desktop: Sidebar (Top Right) ───────────────── */}
        <div className="lg:col-start-2 lg:row-start-1" style={glassCard}>
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

        {/* ── Mobile: Video (Middle) | Desktop: Main Content (Left) ─────────────────────── */}
        <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
          {/* 16:9 video container.
              IMPORTANT: #yt-player-wrapper is a STABLE React-owned element that
              never unmounts. initPlayer programmatically creates a fresh
              #yt-player-root div inside it before each YT.Player() call because
              player.destroy() removes its own <iframe> from the DOM entirely,
              which React's vDOM never sees. Rebuilding the div manually avoids
              the black screen / unresponsive player regression. */}
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: "16px", overflow: "hidden", background: "#000", boxShadow: "0 16px 40px rgba(0,0,0,0.2)" }}>
            <style>{`
              #yt-player-wrapper,
              #yt-player-root,
              #yt-player-root iframe {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                border: none;
              }
            `}</style>
            {/* Stable wrapper — React always keeps this in the DOM */}
            <div id="yt-player-wrapper" />
          </div>

          {/* Permanent YT failures (embed disabled, video unavailable) and
              repeated transient failures both surface here. */}
          {playerError !== null && (
            <div style={{
              marginTop: "10px", padding: "10px 14px", borderRadius: "10px",
              background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.2)",
              fontSize: "13px", color: "#c53030", fontWeight: 500, textAlign: "center",
              display: "flex", flexDirection: "column", gap: "6px",
            }}>
              <span>This class is not available right now.</span>
              <button
                type="button"
                onClick={() => {
                  const fb = Sentry.getFeedback?.();
                  if (!fb) return;
                  const ctx = `Lesson: ${lesson?.title ?? lesson?.id ?? "unknown"}\nVideo: ${lesson?.video_id ?? "unknown"}\nYT error code: ${playerError}`;
                  fb.createForm().then((form) => {
                    form.appendToDom();
                    form.open();
                    const ta = document.querySelector<HTMLTextAreaElement>("textarea[name='message']");
                    if (ta) ta.value = ctx;
                  }).catch(() => {});
                }}
                style={{
                  background: "none", border: "none", color: "#c53030",
                  fontSize: "12px", fontWeight: 700, cursor: "pointer",
                  textDecoration: "underline", padding: 0,
                }}
              >
                Report?
              </button>
            </div>
          )}

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

        {/* ── Mobile: Controls (Bottom) | Desktop: Sidebar (Bottom Right) ───────────────── */}
        <div className="lg:col-start-2 lg:row-start-2 flex flex-col gap-4">

          {/* Take Module Test(s) — a module can have several. Hidden while other
              lessons in the module are incomplete: the quiz isn't the next
              milestone yet, so the Next Lesson CTA below is the real action. */}
          {lesson.module_quiz_ids.length > 0 && !quizBlockedByOtherLessons && (
            <div style={glassCard}>
              <p style={S.sectionLabel}>{lesson.module_quiz_ids.length > 1 ? "Module Quizzes" : "Module Quiz"}</p>
              {isPreview ? (
                <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", marginTop: "10px" }}>
                  {lesson.module_quiz_ids.length} module quiz{lesson.module_quiz_ids.length !== 1 ? "zes" : ""} attached. Quiz-taking is available to students only.
                </p>
              ) : isUnlocked ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
                  {lesson.module_quiz_ids.map((quizId, qi) => {
                    const attempts = attemptsByQuiz[quizId] ?? [];
                    return (
                      <div key={quizId}>
                        <Link
                          href={withFrom(`/dashboard/quiz/${quizId}`, currentUrl)}
                          style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none" }}
                        >
                          {lesson.module_quiz_ids.length > 1 ? `Take Module Quiz ${qi + 1} →` : "Take Module Quiz →"}
                        </Link>
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
                      </div>
                    );
                  })}
                </div>
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
                href={carryFrom(`/dashboard/courses/${courseId}/lessons/${lesson.prev_lesson_id}`)}
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
                  {crossModuleBlocked
                    ? "🔒 Complete this module's lessons & quiz to start the next module"
                    : "🔒 Watch 80% to unlock Next Lesson"}
                </div>
              ) : (
                <Link
                  href={carryFrom(`/dashboard/courses/${courseId}/lessons/${lesson.next_lesson_id}`)}
                  style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none" }}
                >
                  {lesson.next_in_new_module ? "Next Module →" : "Next Lesson →"}
                </Link>
              )
            )}
            <Link
              href={getBackHref(from, `/dashboard/courses/${courseId}`)}
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
  background: "#ffffff",
  borderRadius: "20px", padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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
