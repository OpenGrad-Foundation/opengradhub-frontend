"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Calculator as CalculatorIcon, ChevronLeft, ChevronRight, Clock, Flag, Lock } from "lucide-react";
import { getBackHref, withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { BackLink } from "@/components/back-link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { hasEffectiveSelfScope, PERM } from "@/lib/permissions";
import {
  getQuizById,
  startQuizAttempt,
  submitQuizAttempt,
  saveQuizAnswers,
  ApiError,
  getQuizAttempts,
  getAttemptExplanations,
  advanceQuizSection,
  logProctorEvent,
  downloadStudentTestReportPdf,
  type Quiz,
  type StartedAttempt,
  type StartedAttemptSection,
  type QuizAttempt,
  type QuizAttemptQuestion,
  type WrongExplanation,
  type StudentReportPdf,
  getMyQuestionReports,
} from "@/lib/api";
import { isTerminalSubmitError } from "@/lib/quiz-submit-recovery";
import { ReportQuestionButton } from "@/components/report-question-modal";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { QuestionView, type AnswerMap } from "@/components/question-view";
import { loadDraft, saveDraft, clearDraft, type QuizDraft } from "@/lib/quiz-draft";
import { computeSectionStats, type SectionStats } from "@/lib/section-stats";
import { CalculatorWindow } from "@/components/calculator-window";
import { useInvalidate } from "@/lib/mutations/invalidation";

// ── PDF helper ────────────────────────────────────────────────────────────────
// The report endpoints are bearer-token protected, so `window.open` cannot fetch
// them directly. Each PDF is fetched as a blob via the api helpers and the
// resulting object URL is opened in a new tab (with a download fallback if the
// popup is blocked).
function openPdf({ blob, filename }: StudentReportPdf) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pageOuter: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--color-background)",
  color: "var(--color-text)",
};

const pageInner: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "32px 20px",
};

const pageCentered: React.CSSProperties = {
  maxWidth: "760px",
  margin: "0 auto",
  padding: "32px 16px",
  color: "var(--color-text)",
};

const card: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "12px",
  padding: "clamp(16px, 4vw, 24px)",
  marginBottom: "20px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "var(--color-text)",
  margin: "0 0 8px",
};

const subtext: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--color-text-muted)",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "rgba(10,190,98,0.1)",
  color: "#08784a",
  borderRadius: "6px",
  padding: "3px 8px",
  fontSize: "12px",
  fontWeight: 600,
  marginRight: "8px",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "44px",
  background: "var(--green)",
  color: "var(--dark-teal)",
  border: "1px solid var(--green)",
  borderRadius: "12px",
  padding: "8px 20px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type TimingMap = Record<string, number>;         // snapshot_id → accumulated seconds

type ResultState = {
  attempt_id: string;
  score: number;
  max_score: number;
  passed: boolean | null;
  show_answers_after: boolean;
};

// ── YouTube embed helper ──────────────────────────────────────────────────────

function getYouTubeEmbedUrl(url: string): string | null {
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

// ── Timing breakdown ──────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function TimingBreakdown({ questions, timings }: { questions: QuizAttemptQuestion[]; timings: TimingMap }) {
  const rows: { label: string; seconds: number }[] = [];
  questions.forEach((q, i) => {
    rows.push({
      label: `Q${i + 1}${q.question_type === "GROUP" ? " (group)" : ""}`,
      seconds: timings[q.snapshot_id] ?? 0,
    });
  });

  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.seconds, 0);
  const max   = Math.max(1, ...rows.map((r) => r.seconds));

  return (
    <div style={{ marginTop: "24px", padding: "20px 24px", background: "var(--color-surface-sunken)", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
        <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 }}>
          Time per question
        </p>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#08784a" }}>Total {fmtTime(total)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text)", width: "72px", flexShrink: 0 }}>{r.label}</span>
            <div style={{ flex: 1, height: "8px", borderRadius: "100px", background: "var(--color-border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.seconds / max) * 100}%`, borderRadius: "100px", background: "var(--green)" }} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", width: "64px", textAlign: "right", flexShrink: 0 }}>
              {fmtTime(r.seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QuizTakingPage() {
  const { id: quizId } = useParams<{ id: string }>();
  const router = useRouter();
  const from = useSearchParams().get("from");
  const currentUrl = useCurrentUrl();
  const { data: userData, isLoading: userLoading } = useCurrentUser();
  const canAttempt = hasEffectiveSelfScope(userData?.permissions) && !!userData?.permissions.includes(PERM.assessments.attempt);
  // Stamped onto every draft so startup recovery only ever offers this
  // account's own pending submits back — IndexedDB is shared per browser.
  const { userId: clerkUserId } = useAuth();
  const invalidate = useInvalidate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<StartedAttempt | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [result, setResult] = useState<ResultState | null>(null);
  const [phase, setPhase] = useState<"loading" | "intro" | "taking" | "submitting" | "result" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenExited, setFullscreenExited] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [pastAttempts, setPastAttempts] = useState<QuizAttempt[]>([]);
  const [incompleteAttempt, setIncompleteAttempt] = useState<QuizAttempt | null>(null);
  const [explanations, setExplanations] = useState<WrongExplanation[]>([]);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Question-by-question navigation state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [reportedSnapshots, setReportedSnapshots] = useState<Set<string>>(new Set());
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showReloadWarning, setShowReloadWarning] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);

  // Sectioned quiz state
  const [sections, setSections] = useState<StartedAttemptSection[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState<number | null>(null);
  const [advancingSection, setAdvancingSection] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const timingsRef         = useRef<TimingMap>({});
  const enterTimesRef      = useRef<TimingMap>({});
  const submittingRef      = useRef(false);
  // Holds the retry closure for the last failed submit/advance. Null for
  // non-submit errors so the error screen only offers retry when it makes sense.
  const retrySubmitRef     = useRef<(() => void) | null>(null);
  const handleSubmitRef    = useRef<() => Promise<void>>(async () => {});
  const hasLoadedRef       = useRef(false);
  const beforeUnloadRef    = useRef<((e: BeforeUnloadEvent) => void) | null>(null);
  const draftTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionStartRef    = useRef<number>(Date.now());
  // Server clock minus device clock (ms). A phone whose clock is wrong would
  // otherwise gain or lose quiz time, since started_at is a server timestamp.
  const clockOffsetRef     = useRef(0);
  const answersRef         = useRef<Record<string, string | null>>({});
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSavingRef    = useRef(false);
  const lastServerSaveRef  = useRef("");
  const autosaveAttemptIdRef = useRef<string | null>(null);
  const suppressFsExitRef  = useRef(false);
  // Set once the student confirms "Leave Quiz" so the navigation guards below
  // stop intercepting (otherwise history.back() re-fires popstate → re-opens the
  // dialog → the page never actually leaves).
  const leavingRef         = useRef(false);

  // Warn before browser reload/close during an active attempt
  useEffect(() => {
    if (phase !== "taking") return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (leavingRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    beforeUnloadRef.current = onBeforeUnload;
    function onKeyDown(e: KeyboardEvent) {
      const isReload = e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key === "r");
      if (!isReload) return;
      e.preventDefault();
      setShowReloadWarning(true);
    }
    // Intercept anchor clicks (Next.js Link, plain <a>) so client-side route
    // changes during a live attempt prompt the student before leaving.
    function onClickCapture(e: MouseEvent) {
      if (leavingRef.current) return;
      const path = e.composedPath() as EventTarget[];
      const anchor = path.find(
        (el): el is HTMLAnchorElement =>
          el instanceof HTMLAnchorElement && !!el.getAttribute("href"),
      );
      if (!anchor) return;
      const href = anchor.getAttribute("href")!;
      // Skip hash fragments, mailto, tel, and new-tab opens.
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.target === "_blank") return;
      // Skip clicks on links that point at the current quiz page itself.
      const currentPath = window.location.pathname;
      const targetPath = new URL(href, window.location.origin).pathname;
      if (targetPath === currentPath) return;
      e.preventDefault();
      e.stopPropagation();
      const targetHref = href;
      askConfirm({
        title: "Leave this quiz?",
        body: "Your answers are saved, but the timer keeps running and this counts against your attempt.",
        confirmLabel: "Leave Quiz",
        onConfirm: () => {
          leavingRef.current = true;
          if (beforeUnloadRef.current) window.removeEventListener("beforeunload", beforeUnloadRef.current);
          router.push(targetHref);
        },
      });
    }
    // popstate fires on back/forward — push state back immediately, then ask.
    function onPopState() {
      if (leavingRef.current) return;
      window.history.pushState(null, "", window.location.href);
      askConfirm({
        title: "Leave this quiz?",
        body: "Your answers are saved, but the timer keeps running and this counts against your attempt.",
        confirmLabel: "Leave Quiz",
        onConfirm: () => {
          leavingRef.current = true;
          if (beforeUnloadRef.current) window.removeEventListener("beforeunload", beforeUnloadRef.current);
          // Leave to the assessments hub — a definite destination avoids the
          // history.back() → popstate → re-prompt loop.
          router.push("/dashboard/assessments");
        },
      });
    }
    // Seed a sentinel history entry so the first Back press is catchable.
    window.history.pushState(null, "", window.location.href);

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      beforeUnloadRef.current = null;
    };
  }, [phase]);

  // Count-up / countdown timer. Derived from the wall clock, never `s + 1`:
  // browsers throttle or suspend intervals in background tabs and on locked
  // phones, so a tick counter falls behind the server's deadline and the
  // student's final submit is rejected as late.
  const attemptStartedAt = attempt?.started_at;
  useEffect(() => {
    if (phase !== "taking" || !attemptStartedAt) return;
    const startedMs = new Date(attemptStartedAt).getTime();
    const iv = setInterval(
      () => setTimeElapsed(Math.max(0, Math.floor((Date.now() + clockOffsetRef.current - startedMs) / 1000))),
      1000,
    );
    return () => clearInterval(iv);
  }, [phase, attemptStartedAt]);

  // Auto-submit when time limit reached. Never for sequential sectioned quizzes:
  // the server only accepts their sections through /sections/advance and rejects
  // a whole-quiz submit, so firing it here dead-ends the student on an error
  // screen. Their section timers (auto-advance below) are what ends the quiz.
  const timeLimitSeconds = quiz?.duration_minutes ? quiz.duration_minutes * 60 : null;
  useEffect(() => {
    if (phase !== "taking" || !timeLimitSeconds || submittingRef.current || quiz?.sequential_sections) return;
    if (timeElapsed >= timeLimitSeconds) void handleSubmitRef.current();
  }, [timeElapsed, timeLimitSeconds, phase, quiz?.sequential_sections]);

  // Per-section timer derivation (sequential sectioned quizzes)
  const activeSectionMeta = currentSectionIdx != null ? sections[currentSectionIdx] : null;
  const sectionDurationSec = activeSectionMeta?.duration_minutes != null
    ? activeSectionMeta.duration_minutes * 60
    : null;
  const sectionElapsed = Math.max(0, Math.floor((Date.now() - sectionStartRef.current) / 1000));
  const sectionRemaining = sectionDurationSec != null ? Math.max(0, sectionDurationSec - sectionElapsed) : null;

  // Auto-advance on section timer expiry
  useEffect(() => {
    if (phase !== "taking" || !quiz?.sequential_sections) return;
    if (sectionRemaining === 0 && !advancingSection) {
      void handleAdvanceSection();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionRemaining, phase, quiz?.sequential_sections, advancingSection]);

  // Per-question timing: track via currentIdx changes instead of IntersectionObserver
  useEffect(() => {
    if (phase !== "taking" || !attempt) return;
    const q = attempt.questions[currentIdx];
    if (!q) return;
    const sid = q.snapshot_id;
    enterTimesRef.current[sid] = Date.now();
    return () => {
      const entered = enterTimesRef.current[sid];
      if (entered) {
        timingsRef.current[sid] = (timingsRef.current[sid] ?? 0) + Math.round((Date.now() - entered) / 1000);
        delete enterTimesRef.current[sid];
      }
    };
  }, [currentIdx, phase, attempt]);

  // Which questions this student already reported — so the button shows "Reported" after a reload.
  useEffect(() => {
    const attemptId = attempt?.attempt_id;
    if (!attemptId) return;
    let cancelled = false;
    getMyQuestionReports(attemptId)
      .then((rows) => {
        if (cancelled) return;
        setReportedSnapshots(
          new Set(rows.map((r) => r.question_snapshot_id).filter((s): s is string => !!s)),
        );
      })
      .catch(() => undefined); // non-blocking: a failure here must never break the attempt
    return () => { cancelled = true; };
  }, [attempt?.attempt_id]);

  // Fullscreen proctoring: detect and log exits
  useEffect(() => {
    if (phase !== "taking" || !quiz?.require_fullscreen) return;
    function onChange() {
      const inFs = !!document.fullscreenElement;
      if (!inFs && attempt) {
        if (suppressFsExitRef.current) return; // intentional exit (submit) — silent
        setFullscreenExited(true);
        void logProctorEvent(attempt.attempt_id, "fullscreen_exit").catch(() => {});
      } else if (inFs) {
        setFullscreenExited(false);
      }
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [phase, quiz?.require_fullscreen, attempt]);

  // Autosave answers to the server, at most once per 10s. Throttled rather than
  // debounced: a student answering steadily would never let a debounce fire.
  // Lets the attempt resume on another device and lets the server finalize it
  // if the student never returns. Sequential sectioned quizzes are excluded
  // server-side (their sections persist on advance).
  //
  // One request in flight at a time, so an older save can never land after a
  // newer one; a failed save stays dirty and is retried on the next tick.
  answersRef.current = answers;
  const autosaveAttemptId = phase === "taking" && !quiz?.sequential_sections ? attempt?.attempt_id ?? null : null;
  autosaveAttemptIdRef.current = autosaveAttemptId;
  const queueServerSave = useCallback(() => {
    if (serverSaveTimerRef.current || serverSavingRef.current) return;
    serverSaveTimerRef.current = setTimeout(async () => {
      serverSaveTimerRef.current = null;
      const attemptId = autosaveAttemptIdRef.current;
      const snapshot = JSON.stringify(answersRef.current);
      if (!attemptId || snapshot === lastServerSaveRef.current) return;
      serverSavingRef.current = true;
      let retry = true;
      try {
        await saveQuizAnswers(
          attemptId,
          Object.entries(answersRef.current).map(([snapshot_id, student_answer]) => ({ snapshot_id, student_answer })),
        );
        lastServerSaveRef.current = snapshot;
      } catch (err) {
        // Best-effort: the local draft and the final submit remain the source of
        // truth. A 4xx will not get better on retry (attempt submitted/reset).
        if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) retry = false;
      } finally {
        serverSavingRef.current = false;
      }
      if (retry && autosaveAttemptIdRef.current === attemptId && JSON.stringify(answersRef.current) !== lastServerSaveRef.current) {
        queueServerSave();
      }
    }, 10_000);
  }, []);
  useEffect(() => {
    if (!autosaveAttemptId || Object.keys(answers).length === 0) return;
    queueServerSave();
  }, [answers, autosaveAttemptId, queueServerSave]);
  // Leaving the taking phase (submit, result, unmount) cancels a pending save —
  // it must not race the final submit.
  useEffect(() => {
    if (autosaveAttemptId) return;
    if (serverSaveTimerRef.current) { clearTimeout(serverSaveTimerRef.current); serverSaveTimerRef.current = null; }
  }, [autosaveAttemptId]);
  useEffect(() => () => {
    if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
    // Also disarms the retry of a save still in flight: its guard compares against this ref.
    autosaveAttemptIdRef.current = null;
  }, []);

  // Debounced autosave of in-progress answers to IndexedDB.
  useEffect(() => {
    if (phase !== "taking" || !attempt) return;
    const activeSectionMeta = currentSectionIdx != null ? sections[currentSectionIdx] : null;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      void saveDraft({
        attempt_id: attempt.attempt_id,
        user_id: clerkUserId ?? undefined,
        answers,
        flagged: [...flagged],
        current_idx: currentIdx,
        updated_at: Date.now(),
        section_state: (quiz?.is_sectioned && !quiz?.sequential_sections && activeSectionMeta)
          ? { current_section_id: activeSectionMeta.section_id }
          : undefined,
      }).catch(() => {});
    }, 500);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [answers, flagged, currentIdx, phase, attempt, sections, currentSectionIdx, quiz?.is_sectioned, quiz?.sequential_sections, clerkUserId]);

  useEffect(() => {
    if (userLoading || !userData || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (!hasEffectiveSelfScope(userData.permissions)) {
      setError("Quiz attempts require your own learning scope.");
      setPhase("error");
      return;
    }

    async function load() {
      try {
        const [q, attempts] = await Promise.all([
          getQuizById(quizId),
          getQuizAttempts(quizId),
        ]);
        setQuiz(q);
        const completed = attempts.filter((a) => a.is_complete);
        setAttemptsUsed(completed.length);
        setPastAttempts(completed);
        setIncompleteAttempt(attempts.find((a) => !a.is_complete) ?? null);

        setPhase("intro");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load quiz.");
        setPhase("error");
      }
    }
    void load();
  }, [userLoading, userData, quizId]);

  async function handleStart() {
    if (!canAttempt) return;
    retrySubmitRef.current = null;
    try {
      if (quiz?.require_fullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          setError("Fullscreen is required for this quiz but the browser blocked it. Please allow fullscreen and try again.");
          setPhase("error");
          return;
        }
      }
      setPhase("loading");
      const started = await startQuizAttempt(quizId);

      clockOffsetRef.current = started.server_now ? new Date(started.server_now).getTime() - Date.now() : 0;
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() + clockOffsetRef.current - new Date(started.started_at).getTime()) / 1000));

      let draft: QuizDraft | null = null;
      try {
        draft = await loadDraft(started.attempt_id);
      } catch {
        // IndexedDB unavailable — non-fatal, start with empty answers.
      }
      setAttempt(started);
      setSections(started.sections);
      setCurrentSectionIdx(started.current_section_index ?? null);
      if (quiz?.sequential_sections) {
        // On resume the section clock continues from its server start (shifted
        // into device time) — a reload must not hand the section's time back.
        sectionStartRef.current = started.current_section_started_at
          ? new Date(started.current_section_started_at).getTime() - clockOffsetRef.current
          : Date.now();
      }
      // Server autosave fills whatever this device's draft lacks (new device,
      // cleared storage); where both have a value the local draft wins.
      // ponytail: no per-answer timestamps, so a stale draft on a second device
      // still beats a newer server value for the same question. Add a server
      // revision if two-device attempts turn out to be real.
      const serverAnswers = quiz?.sequential_sections ? {} : started.saved_answers ?? {};
      setAnswers({ ...serverAnswers, ...(draft?.answers ?? {}) });
      lastServerSaveRef.current = "";
      setCurrentIdx(draft?.current_idx ?? 0);
      setFlagged(new Set(draft?.flagged ?? []));
      setTimeElapsed(elapsedSeconds);
      timingsRef.current = {};
      enterTimesRef.current = {};
      if (draft?.section_state?.current_section_id && started.sections.length > 0) {
        const idx = started.sections.findIndex((s) => s.section_id === draft.section_state!.current_section_id);
        if (idx >= 0) setCurrentSectionIdx(idx);
      }
      setPhase("taking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start attempt.");
      setPhase("error");
    }
  }

  async function handleSubmit() {
    if (!attempt) return;
    retrySubmitRef.current = null;
    submittingRef.current = true;
    setSubmitting(true);
    setPhase("submitting");
    try {
      const now = Date.now();
      for (const [sid, entered] of Object.entries(enterTimesRef.current)) {
        timingsRef.current[sid] = (timingsRef.current[sid] ?? 0) + Math.round((now - entered) / 1000);
      }
      enterTimesRef.current = {};

      const allSnapshotIds: string[] = [];
      for (const q of attempt.questions) {
        if (q.question_type === 'GROUP') {
          for (const child of q.children) allSnapshotIds.push(child.snapshot_id);
        } else {
          allSnapshotIds.push(q.snapshot_id);
        }
      }
      const answerList = allSnapshotIds.map((snapshot_id) => ({
        snapshot_id,
        student_answer: answers[snapshot_id] ?? null,
        time_taken_seconds: timingsRef.current[snapshot_id] ?? null,
      }));
      // Persist the exact submit payload before the POST so a crash mid-submit
      // can be replayed on next launch without rebuilding from in-memory state.
      await saveDraft({
        attempt_id: attempt.attempt_id,
        user_id: clerkUserId ?? undefined,
        answers,
        flagged: Array.from(flagged),
        current_idx: currentIdx,
        updated_at: Date.now(),
        submit_pending_at: Date.now(),
        quiz_id: quizId,
        submit_payload: answerList,
        submit_kind: 'full',
      }).catch(() => {});
      const res = await submitQuizAttempt(attempt.attempt_id, answerList);
      invalidate('quizAttempt');
      // Draft cleanup is best-effort — a failure here must not error a successful submit.
      void clearDraft(attempt.attempt_id).catch(() => {});
      setResult({
        attempt_id: res.attempt_id,
        score: res.score,
        max_score: res.max_score,
        passed: res.passed,
        show_answers_after: quiz?.show_answers_after ?? false,
      });
      const vids = await getAttemptExplanations(res.attempt_id);
      setExplanations(vids);
      suppressFsExitRef.current = true;
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
      setTimeout(() => { suppressFsExitRef.current = false; }, 500);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz.");
      if (isTerminalSubmitError(err)) {
        // Terminal: the attempt was discarded (expired with nothing answered),
        // reset, or already submitted (e.g. by the server's finalize job).
        // Retrying can never succeed — drop the draft so the next Start is fresh.
        void clearDraft(attempt.attempt_id).catch(() => {});
        setIncompleteAttempt(null);
      } else {
        retrySubmitRef.current = () => { void handleSubmit(); };
      }
      setPhase("error");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  handleSubmitRef.current = handleSubmit;

  async function handleDownloadTestReport() {
    setDownloadingReport(true);
    setReportError(null);
    try {
      openPdf(await downloadStudentTestReportPdf("me", quizId));
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Failed to download report.");
    } finally {
      setDownloadingReport(false);
    }
  }

  function askConfirm(opts: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) {
    setConfirmModal(opts);
  }

  async function handleAdvanceSection() {
    if (!attempt) return;
    // Per-section unanswered count for the active section.
    const currentSection = currentSectionIdx != null ? sections[currentSectionIdx] : null;
    const sectionQs = currentSection
      ? attempt.questions.filter((q) => q.section_id === currentSection.section_id)
      : attempt.questions;
    const localStats = computeSectionStats(sectionQs, answers, flagged);
    const body = localStats.unanswered > 0
      ? `This section has ${localStats.unanswered} unanswered question(s). Submit anyway? You won't be able to return.`
      : "Submit this section? You won't be able to return to it.";
    askConfirm({
      title: "Submit Section?",
      body,
      confirmLabel: "Submit Section",
      onConfirm: () => { void doAdvance(); },
    });

    async function doAdvance() {
      if (!attempt) return;
      retrySubmitRef.current = null;
      setAdvancingSection(true);
      try {
        // Flush the in-progress question's timing so the last question on the page
        // gets credited the time the student actually spent on it.
        const now = Date.now();
        for (const [sid, entered] of Object.entries(enterTimesRef.current)) {
          timingsRef.current[sid] = (timingsRef.current[sid] ?? 0) + Math.round((now - entered) / 1000);
        }
        enterTimesRef.current = {};

        // Build the answer list for the CURRENT section's questions only
        const allSnapshotIds: string[] = [];
        for (const q of attempt.questions) {
          if (q.question_type === "GROUP") {
            for (const child of q.children) allSnapshotIds.push(child.snapshot_id);
          } else {
            allSnapshotIds.push(q.snapshot_id);
          }
        }
        const answerList = allSnapshotIds.map((sid) => ({
          snapshot_id: sid,
          student_answer: answers[sid] ?? null,
          time_taken_seconds: timingsRef.current[sid] ?? null,
        }));
        const isFinalSection = currentSectionIdx != null && currentSectionIdx >= sections.length - 1;
        if (isFinalSection) {
          setPhase("submitting");
          // Final-section advance IS the submit — persist its payload for crash replay.
          await saveDraft({
            attempt_id: attempt.attempt_id,
            user_id: clerkUserId ?? undefined,
            answers,
            flagged: Array.from(flagged),
            current_idx: currentIdx,
            updated_at: Date.now(),
            submit_pending_at: Date.now(),
            quiz_id: quizId,
            submit_payload: answerList,
            submit_kind: 'section',
          }).catch(() => {});
        }
        const res = await advanceQuizSection(attempt.attempt_id, answerList);
        if (res.type === "next") {
          if (isFinalSection) setPhase("taking"); // recover: server returned next unexpectedly
          setAttempt({ ...attempt, questions: res.snapshots });
          setCurrentSectionIdx(res.section_index);
          sectionStartRef.current = Date.now();
          setCurrentIdx(0);
          setFlagged(new Set());
          timingsRef.current = {};
          enterTimesRef.current = {};
        } else {
          // type === "done" — finalize (phase already "submitting", will become "result")
          setResult({
            attempt_id: res.result.attempt_id,
            score: res.result.score,
            max_score: res.result.max_score,
            passed: res.result.passed,
            show_answers_after: quiz?.show_answers_after ?? false,
          });
          void clearDraft(attempt.attempt_id).catch(() => {});
          const vids = await getAttemptExplanations(res.result.attempt_id);
          setExplanations(vids);
          suppressFsExitRef.current = true;
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          }
          setTimeout(() => { suppressFsExitRef.current = false; }, 500);
          setPhase("result");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to advance section.");
        retrySubmitRef.current = () => { void doAdvance(); };
        setPhase("error");
      } finally {
        setAdvancingSection(false);
      }
    }
  }

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === "loading" || userLoading) {
    return (
      <div style={{ ...pageCentered, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <p style={subtext}>Loading…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div style={pageCentered}>
        <div style={card}>
          <p style={{ ...heading, color: "#b83232" }}>Error</p>
          <p style={subtext}>{error}</p>
          {retrySubmitRef.current && (
            <button
              onClick={() => { const fn = retrySubmitRef.current; if (fn) fn(); }}
              style={primaryBtn}
            >
              Retry Submit
            </button>
          )}
          <button
            onClick={() => router.push(getBackHref(from, "/dashboard/assessments"))}
            style={retrySubmitRef.current ? secondaryBtn : primaryBtn}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (phase === "intro" && quiz) {
    const exhausted = quiz.max_attempts != null && quiz.max_attempts > 0 && attemptsUsed >= quiz.max_attempts;
    // Device clock only (no server offset before Start) — good enough to pick the wording.
    const attemptTimeIsUp = !!incompleteAttempt && !!quiz.duration_minutes && !quiz.sequential_sections
      && Date.now() - new Date(incompleteAttempt.started_at).getTime() > quiz.duration_minutes * 60_000;
    return (
      <div style={pageCentered}>
        <BackLink fallback="/dashboard/assessments" style={{ ...secondaryBtn, textDecoration: "none", marginBottom: "20px" }}>
          <ArrowLeft size={16} aria-hidden="true" />Back to Quizzes
        </BackLink>
        <div style={card}>
          <p style={{ ...subtext, marginBottom: "6px" }}>
            {quiz.quiz_type === "MODULE_TEST" ? "Module Quiz" : "Global Quiz"}
          </p>
          <h1 style={heading}>{quiz.title}</h1>
          <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {quiz.duration_minutes && <span style={pill}><Clock size={12} aria-hidden="true" />{quiz.duration_minutes} min</span>}
            {quiz.max_attempts != null && quiz.max_attempts > 0 && (
              <span style={pill}>
                {attemptsUsed}/{quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? "s" : ""} used
              </span>
            )}
            {quiz.pass_threshold_percent && (
              <span style={pill}>Pass: {quiz.pass_threshold_percent}%</span>
            )}
            <span style={pill}>{quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}</span>
          </div>

          {quiz.description != null && quiz.description.trim() !== "" && (
            <div style={{
              marginTop: "20px",
              padding: "16px 20px",
              background: "var(--color-surface-sunken)",
              border: "1px solid var(--color-border)",
              borderLeft: "3px solid var(--green)",
              borderRadius: "8px",
            }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: "0 0 8px" }}>
                Test instructions
              </p>
              <MathContent html={quiz.description} style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--color-text)" }} />
            </div>
          )}

          {canAttempt && !!quiz.duration_minutes && (
            <p style={{ ...subtext, marginTop: "20px", fontWeight: 600, color: attemptTimeIsUp ? "#b83232" : undefined }}>
              {attemptTimeIsUp
                ? "Time ran out on the attempt you started earlier. Your saved answers will be submitted now; if nothing was answered, the attempt is discarded and you can start again."
                : "The timer starts when you press Start and keeps running even if you close this page or lock your phone. When it ends, your answers are submitted automatically."}
            </p>
          )}

          {canAttempt && (() => {
            const fsRequired = !!quiz?.require_fullscreen;
            const fsSupported = typeof document !== "undefined" && !!document.fullscreenEnabled;
            const fsBlockMobile = fsRequired && !fsSupported;
            if (fsBlockMobile) {
              return (
                <p style={{ ...subtext, marginTop: "20px", color: "#b83232", fontWeight: 600 }}>
                  This quiz requires fullscreen mode, which isn&apos;t supported on this device. Please use a desktop browser (Chrome / Edge / Firefox) to take this quiz.
                </p>
              );
            }
            return exhausted && !incompleteAttempt ? (
              <p style={{ ...subtext, marginTop: "20px", color: "#b83232" }}>
                You have used all available attempts for this quiz.
              </p>
            ) : (
              <button onClick={handleStart} style={{ ...primaryBtn, marginTop: "20px" }}>
                {incompleteAttempt
                  ? attemptTimeIsUp ? "Submit My Answers" : "Resume Attempt"
                  : attemptsUsed > 0
                    ? "Retake Quiz"
                    : "Start Quiz"} <ArrowRight size={16} aria-hidden="true" />
              </button>
            );
          })()}

          {pastAttempts.length > 0 && (
            <div style={{ marginTop: "28px", borderTop: "1px solid var(--color-border)", paddingTop: "20px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", marginBottom: "12px" }}>
                Past attempts
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pastAttempts.map((a) => {
                  const pct = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null;
                  const date = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  return (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg" style={{ background: "var(--color-surface-sunken)" }}>
                      <div className="flex-1">
                        <p className="m-0 text-[14px] font-semibold" style={{ color: "var(--color-text)" }}>
                          Attempt {a.attempt_number} — {a.score ?? "?"}/{a.max_score ?? "?"}{pct !== null ? ` (${pct}%)` : ""}
                        </p>
                        <p className="mt-1 mb-0 text-[12px]" style={{ color: "var(--color-text-muted)" }}>{date}</p>
                      </div>
                      <div className="flex items-center flex-wrap gap-2 mt-2 sm:mt-0">
                        {a.passed !== null && (
                          <span style={{ fontSize: "12px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: a.passed ? "rgba(10,190,98,0.1)" : "rgba(184,50,50,0.1)", color: a.passed ? "#08784a" : "#b83232" }}>
                            {a.passed ? "Passed" : "Failed"}
                          </span>
                        )}
                        <span style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: a.counts_toward_grade ? "rgba(10,190,98,0.1)" : "var(--color-surface)",
                          color:      a.counts_toward_grade ? "#08784a" : "var(--color-text-muted)",
                        }}>
                          {a.counts_toward_grade ? "Counted" : "Practice"}
                        </span>
                        {quiz?.show_answers_after && (
                          <button
                            onClick={() => router.push(withFrom(`/dashboard/quiz/${quizId}/review/${a.id}`, currentUrl))}
                            style={{ ...secondaryBtn, minHeight: "36px", padding: "4px 12px", fontSize: "13px" }}
                          >
                            Review <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div style={pageOuter}>
        <div style={pageCentered}>
          <div style={card}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", gap: "24px" }}>
              <div style={{
                width: "56px", height: "56px",
                border: "4px solid rgba(10,190,98,0.18)",
                borderTopColor: "var(--green)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
              <p style={{ ...heading, margin: 0, textAlign: "center" }}>Submitting your quiz…</p>
              <p style={{ ...subtext, margin: 0, textAlign: "center", maxWidth: "420px", lineHeight: 1.6 }}>
                We&apos;re saving your answers and grading the attempt. Please don&apos;t close this tab — this should only take a few seconds.
              </p>
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (phase === "taking" && attempt) {
    const questions = attempt.questions;
    const total = questions.length;
    const safeIdx = Math.min(currentIdx, total - 1);
    const q = questions[safeIdx];
    if (!q) return null;
    const isFirst = safeIdx === 0;
    const isLast = safeIdx === total - 1;
    const isFlagged = flagged.has(q.snapshot_id);

    // Per-section + global stats (sectioned quizzes only).
    const sectionStatsMap = new Map<string, SectionStats>();
    if (quiz?.is_sectioned) {
      for (const s of sections) {
        const qs = attempt.questions.filter((q) => q.section_id === s.section_id);
        sectionStatsMap.set(s.section_id, computeSectionStats(qs, answers, flagged));
      }
    }
    const globalStats = computeSectionStats(attempt.questions, answers, flagged);

    // Section-aware navigation
    const currentSectionId = attempt.questions[safeIdx]?.section_id ?? null;
    const nextQuestion = attempt.questions[safeIdx + 1];
    const isSectionLast =
      isLast ||
      (!!currentSectionId && nextQuestion?.section_id !== currentSectionId);
    const nextSectionFirstIdx = currentSectionId
      ? attempt.questions.findIndex(
          (q, i) => i > safeIdx && q.section_id !== currentSectionId,
        )
      : -1;

    const timeRemaining = timeLimitSeconds ? timeLimitSeconds - timeElapsed : null;
    const displaySeconds = timeRemaining !== null ? Math.max(0, timeRemaining) : timeElapsed;
    const mins = Math.floor(displaySeconds / 60);
    const secs = displaySeconds % 60;
    const timerStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    const timerIsLow = timeRemaining !== null && timeRemaining < 60;

    function getQuestionStatus(i: number): "answered" | "unanswered" {
      const qi = questions[i];
      const answered =
        answers[qi.snapshot_id] != null ||
        (qi.question_type === "GROUP" && qi.children.some((c) => answers[c.snapshot_id] != null));
      return answered ? "answered" : "unanswered";
    }

    function buildFinalSubmitPrompt(): string {
      if (!attempt) return "Submit this quiz?";
      if (quiz?.is_sectioned) {
        const sectionLines: string[] = [];
        for (const s of sections) {
          const qs = attempt.questions.filter((q) => q.section_id === s.section_id);
          const ss = computeSectionStats(qs, answers, flagged);
          if (ss.unanswered > 0) sectionLines.push(`  • ${s.title}: ${ss.unanswered} unanswered`);
        }
        if (sectionLines.length > 0) {
          return "You have unanswered questions:\n\n" + sectionLines.join("\n") + "\n\nSubmit anyway? You cannot change your answers after submitting.";
        }
      } else {
        const gs = computeSectionStats(attempt.questions, answers, flagged);
        if (gs.unanswered > 0) {
          return `You have ${gs.unanswered} unanswered question(s). Submit anyway? You cannot change your answers after submitting.`;
        }
      }
      return "Submit this quiz? You cannot change your answers after submitting.";
    }

    return (
      <div style={{
        ...pageOuter,
        position: "fixed",
        inset: 0,
        zIndex: 100,
        overflowY: "auto",
      }}>
        {fullscreenExited && phase === "taking" && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "rgba(184,50,50,0.96)",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
            color: "#fff", padding: "40px", textAlign: "center",
          }}>
            <h2 style={{ fontSize: "28px", fontWeight: 700, margin: 0, marginBottom: "16px" }}>Fullscreen Exited</h2>
            <p style={{ fontSize: "16px", margin: 0, marginBottom: "24px", maxWidth: "500px", lineHeight: 1.6 }}>
              This quiz requires fullscreen mode. The exit has been logged. Return to fullscreen to continue.
            </p>
            <button
              onClick={async () => {
                try { await document.documentElement.requestFullscreen(); } catch { /* user gesture failed */ }
              }}
              style={{
                minHeight: "44px", padding: "8px 24px", borderRadius: "12px",
                background: "#fff", color: "#b83232",
                fontSize: "15px", fontWeight: 600, border: "1px solid #fff", cursor: "pointer",
              }}
            >
              Return to Fullscreen
            </button>
          </div>
        )}
        {showReloadWarning && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)", maxWidth: "420px", width: "90%" }}>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 12px" }}>Reload this page?</p>
              <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
                Your answers are <strong>saved automatically</strong>. You can safely reload — your progress will be restored.
              </p>
              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={() => setShowReloadWarning(false)}
                  style={{ ...primaryBtn, flex: 1 }}
                >
                  Stay on page
                </button>
                <button
                  onClick={() => {
                    if (beforeUnloadRef.current) window.removeEventListener("beforeunload", beforeUnloadRef.current);
                    window.location.reload();
                  }}
                  style={{ ...secondaryBtn, flex: 1 }}
                >
                  Reload anyway
                </button>
              </div>
            </div>
          </div>
        )}
        {confirmModal && phase === "taking" && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 99998,
            background: "rgba(3,72,82,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}>
            <div style={{
              background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px",
              padding: "clamp(16px, 4vw, 24px)", maxWidth: "480px", width: "100%",
            }}>
              <p style={{ fontSize: "18px", fontWeight: 700, color: "var(--color-text)", margin: "0 0 12px" }}>
                {confirmModal.title}
              </p>
              <p style={{
                fontSize: "14px", color: "var(--color-text-muted)",
                margin: "0 0 24px", lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
                {confirmModal.body}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmModal(null)}
                  style={secondaryBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const fn = confirmModal.onConfirm;
                    setConfirmModal(null);
                    fn();
                  }}
                  style={primaryBtn}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={pageInner}>
          {/* Header */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>{quiz?.title}</p>
            <span style={{ ...pill, background: "var(--color-surface-sunken)", color: "var(--color-text)", margin: 0 }}>
              Attempt #{attempt.attempt_number}
            </span>
          </div>

          {/* Section tab header (when sectioned) */}
          {quiz?.is_sectioned && sections.length > 0 && (
            <div style={{
              display: "flex",
              gap: "4px",
              marginBottom: "16px",
              borderBottom: "2px solid var(--color-border)",
              flexWrap: "wrap",
            }}>
              {sections.map((s, i) => {
                const isActive = currentSectionIdx === i || (currentSectionIdx == null && i === 0);
                const isLocked = quiz.sequential_sections && currentSectionIdx != null && i < currentSectionIdx;
                const isPending = quiz.sequential_sections && currentSectionIdx != null && i > currentSectionIdx;
                const clickable = !quiz.sequential_sections && !isLocked && !isPending;
                const stats = sectionStatsMap.get(s.section_id);
                return (
                  <div
                    key={s.section_id}
                    onClick={() => {
                      if (!clickable) return;
                      const firstIdx = attempt.questions.findIndex((q) => q.section_id === s.section_id);
                      if (firstIdx >= 0) setCurrentIdx(firstIdx);
                    }}
                    style={{
                      padding: "10px 18px",
                      fontSize: "14px",
                      fontWeight: 600,
                      background: isActive ? "var(--color-surface)" : "transparent",
                      color: isActive ? "#08784a" : (isLocked || isPending) ? "var(--color-text-muted)" : "var(--color-text)",
                      borderBottom: `3px solid ${isActive ? "var(--green)" : "transparent"}`,
                      marginBottom: "-2px",
                      cursor: clickable ? "pointer" : (isLocked || isPending) ? "not-allowed" : "default",
                      opacity: (isLocked || isPending) ? 0.6 : 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>{s.title}</span>
                    {stats && (
                      <span style={{ fontSize: "11px", fontWeight: 600, opacity: 0.75 }}>
                        {stats.answered}/{stats.total}
                        {stats.flagged > 0 && <> <Flag size={11} aria-hidden="true" style={{ verticalAlign: "-1px" }} />{stats.flagged}</>}
                      </span>
                    )}
                    {isLocked && <Lock size={12} aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Two-column layout */}
          <div className="flex flex-col-reverse lg:flex-row gap-5 items-start">
            {/* Main question card */}
            <div className="flex-1 min-w-0 w-full">
              <div style={card}>
                {/* Question header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-text)" }}>
                    Question {currentIdx + 1} of {total}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {/* A GROUP parent is not answerable — its children carry their own buttons. */}
                    {q.question_type !== "GROUP" && (
                      <ReportQuestionButton
                        snapshotId={q.snapshot_id}
                        alreadyReported={reportedSnapshots.has(q.snapshot_id)}
                        onReported={() => setReportedSnapshots((prev) => new Set(prev).add(q.snapshot_id))}
                      />
                    )}
                    <button
                      onClick={() => toggleFlag(q.snapshot_id)}
                      style={{
                        background: isFlagged ? "rgba(184,50,50,0.1)" : "var(--color-surface)",
                        color: isFlagged ? "#b83232" : "var(--color-text-muted)",
                        border: `1px solid ${isFlagged ? "rgba(184,50,50,0.3)" : "var(--color-border)"}`,
                        borderRadius: "8px",
                        minHeight: "36px",
                        padding: "6px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Flag size={14} aria-hidden="true" />{isFlagged ? "Marked for Review" : "Mark for Review"}
                    </button>
                  </div>
                </div>

                {/* Question body */}
                <QuestionView
                  q={q}
                  answers={answers}
                  setAnswer={setAnswer}
                  renderReportButton={(snapshotId) => (
                    <ReportQuestionButton
                      snapshotId={snapshotId}
                      alreadyReported={reportedSnapshots.has(snapshotId)}
                      onReported={() => setReportedSnapshots((prev) => new Set(prev).add(snapshotId))}
                    />
                  )}
                />

                {/* Navigation */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "32px",
                  paddingTop: "20px",
                  borderTop: "1px solid var(--color-border)",
                }}>
                  <button
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    disabled={isFirst}
                    style={{
                      ...secondaryBtn,
                      opacity: isFirst ? 0.3 : 1,
                      cursor: isFirst ? "default" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <ChevronLeft size={16} aria-hidden="true" />Previous
                  </button>
                  {isLast ? (
                    quiz?.sequential_sections ? (
                      <button
                        onClick={handleAdvanceSection}
                        disabled={advancingSection}
                        style={{ ...primaryBtn, opacity: advancingSection ? 0.6 : 1 }}
                      >
                        {advancingSection
                          ? "Submitting…"
                          : currentSectionIdx != null && currentSectionIdx >= sections.length - 1
                            ? "Submit Final Section"
                            : <>Submit Section <ArrowRight size={16} aria-hidden="true" /></>}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          askConfirm({
                            title: "Submit Quiz?",
                            body: buildFinalSubmitPrompt(),
                            confirmLabel: "Submit Quiz",
                            onConfirm: () => { void handleSubmit(); },
                          });
                        }}
                        disabled={submitting}
                        style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}
                      >
                        {submitting ? "Submitting…" : "Submit Quiz"}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => {
                        if (!quiz?.sequential_sections && isSectionLast && nextSectionFirstIdx >= 0) {
                          setCurrentIdx(nextSectionFirstIdx);
                        } else {
                          setCurrentIdx((i) => Math.min(total - 1, i + 1));
                        }
                      }}
                      disabled={isLast}
                      style={{ ...primaryBtn, display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {!quiz?.sequential_sections && isSectionLast && nextSectionFirstIdx >= 0
                        ? <>Next Section <ArrowRight size={16} aria-hidden="true" /></>
                        : <>Next <ChevronRight size={16} aria-hidden="true" /></>}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-[220px] shrink-0">
              <div style={{ ...card, padding: "20px", marginBottom: "12px" }}>
                {/* Timer */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid var(--color-border)",
                }}>
                  {quiz?.sequential_sections && sectionRemaining != null ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, color: sectionRemaining < 60 ? "#b83232" : "var(--color-text)" }}>
                      <Clock size={16} aria-hidden="true" />Section: {Math.floor(sectionRemaining / 60)}:{(sectionRemaining % 60).toString().padStart(2, "0")}
                    </span>
                  ) : (
                    <>
                      <Clock size={18} aria-hidden="true" style={{ color: timerIsLow ? "#b83232" : "var(--color-text)" }} />
                      <span style={{
                        fontSize: "22px",
                        fontWeight: 700,
                        color: timerIsLow ? "#b83232" : "var(--color-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {timerStr}
                      </span>
                    </>
                  )}
                </div>

                {/* Section stats block */}
                {quiz?.is_sectioned && (() => {
                  const showStats = quiz.sequential_sections
                    ? (currentSectionId ? sectionStatsMap.get(currentSectionId) : undefined)
                    : globalStats;
                  const title = quiz.sequential_sections
                    ? (currentSectionIdx != null ? sections[currentSectionIdx]?.title : sections[0]?.title) ?? "Section"
                    : "Quiz Progress";
                  if (!showStats) return null;
                  return (
                    <div style={{
                      padding: "12px",
                      background: "var(--color-surface-sunken)",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "var(--color-text-muted)",
                      }}>{title}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                        {([
                          ["Answered", showStats.answered],
                          ["Unanswered", showStats.unanswered],
                          ["Marked for Review", showStats.flagged],
                          ["Marked + Answered", showStats.flaggedAndAnswered],
                        ] as const).map(([label, value]) => (
                          <div key={label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "20px", fontWeight: 700, lineHeight: 1, color: "var(--color-text)" }}>{value}</span>
                            <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)" }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Question navigator grid */}
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", margin: "0 0 12px" }}>Questions</p>
                <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-4 gap-2">
                  {questions.map((qi, i) => {
                    const isCurrent = i === currentIdx;
                    const status = getQuestionStatus(i);
                    const isQFlagged = flagged.has(qi.snapshot_id);
                    return (
                      <button
                        key={qi.snapshot_id}
                        onClick={() => setCurrentIdx(i)}
                        style={{
                          width: "100%",
                          height: "40px",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          position: "relative",
                          background: isCurrent
                            ? "var(--dark-teal)"
                            : status === "answered"
                              ? "rgba(10,190,98,0.15)"
                              : "var(--color-surface-sunken)",
                          color: isCurrent
                            ? "#fff"
                            : status === "answered"
                              ? "#08784a"
                              : "var(--color-text-muted)",
                          outline: isQFlagged ? "2px solid #b83232" : "none",
                          outlineOffset: "2px",
                        }}
                      >
                        {i + 1}
                        {isQFlagged && (
                          <Flag size={9} aria-hidden="true" style={{ position: "absolute", top: "3px", right: "3px", color: "#b83232" }} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Submit from sidebar */}
                {quiz?.sequential_sections ? (
                  <button
                    onClick={handleAdvanceSection}
                    disabled={advancingSection}
                    style={{
                      ...primaryBtn,
                      width: "100%",
                      marginTop: "20px",
                      padding: "8px 16px",
                      boxSizing: "border-box",
                      opacity: advancingSection ? 0.6 : 1,
                    }}
                  >
                    {advancingSection
                      ? "Submitting…"
                      : currentSectionIdx != null && currentSectionIdx >= sections.length - 1
                        ? "Submit Final Section"
                        : <>Submit Section <ArrowRight size={16} aria-hidden="true" /></>}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      askConfirm({
                        title: "Submit Quiz?",
                        body: buildFinalSubmitPrompt(),
                        confirmLabel: "Submit Quiz",
                        onConfirm: () => { void handleSubmit(); },
                      });
                    }}
                    disabled={submitting}
                    style={{
                      ...primaryBtn,
                      width: "100%",
                      marginTop: "20px",
                      padding: "8px 16px",
                      opacity: submitting ? 0.6 : 1,
                      boxSizing: "border-box",
                    }}
                  >
                    {submitting ? "Submitting…" : "Submit Quiz"}
                  </button>
                )}
              </div>
              {/* On-screen calculator */}
              <div style={{ ...card, padding: "16px" }}>
                <button
                  type="button"
                  onClick={() => setCalcOpen((o) => !o)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    minHeight: "44px",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    border: `1px solid ${calcOpen ? "var(--dark-teal)" : "var(--color-border)"}`,
                    background: calcOpen ? "var(--dark-teal)" : "var(--color-surface)",
                    color: calcOpen ? "#fff" : "var(--color-text)",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                  aria-expanded={calcOpen}
                  aria-label="Toggle calculator"
                >
                  <CalculatorIcon size={16} aria-hidden="true" />Calculator
                </button>
              </div>
            </div>
          </div>
        </div>
        {calcOpen && <CalculatorWindow onClose={() => setCalcOpen(false)} />}
      </div>
    );
  }

  if (phase === "result" && result) {
    const pct = result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : null;
    return (
      <div style={pageCentered}>
        <div style={card}>
          <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", marginBottom: "12px" }}>
            Quiz complete
          </p>
          <h1 style={{ ...heading, fontSize: "24px" }}>{quiz?.title}</h1>

          <div style={{ marginTop: "28px", padding: "24px", background: "var(--color-surface-sunken)", borderRadius: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "48px", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
              {result.score}/{result.max_score}
            </p>
            {pct !== null && (
              <p style={{ fontSize: "20px", color: "var(--color-text-muted)", margin: "4px 0 0" }}>{pct}%</p>
            )}
            {result.passed !== null && (
              <p style={{
                fontSize: "18px", fontWeight: 700, marginTop: "12px",
                color: result.passed ? "#08784a" : "#b83232",
              }}>
                {result.passed ? "Passed" : "Not Passed"}
              </p>
            )}
          </div>

          {attempt && <TimingBreakdown questions={attempt.questions} timings={timingsRef.current} />}

          {explanations.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: "0 0 16px" }}>
                Explanation Videos ({explanations.length} wrong answer{explanations.length !== 1 ? "s" : ""})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {explanations.map((ex, i) => {
                  const embedUrl = getYouTubeEmbedUrl(ex.explanation_video_url);
                  if (!embedUrl) return null;
                  return (
                    <div key={ex.snapshot_id} style={{ padding: "16px", background: "var(--color-danger-surface)", borderRadius: "12px", border: "1px solid rgba(184,50,50,0.15)" }}>
                      <p style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 600, color: "#b83232" }}>
                        Wrong answer #{i + 1}
                      </p>
                      <MathContent html={ex.content_html} style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginBottom: "12px", lineHeight: 1.5 }} />
                      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: "8px", overflow: "hidden" }}>
                        <iframe
                          src={embedUrl}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-6">
            <button onClick={() => router.push(getBackHref(from, "/dashboard/assessments"))} style={primaryBtn}>
              Back to Quizzes
            </button>
            {result.show_answers_after && (
              <button
                onClick={() => router.push(withFrom(`/dashboard/quiz/${quizId}/review/${result.attempt_id}`, currentUrl))}
                style={secondaryBtn}
              >
                Review Answers <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            <button
              onClick={handleDownloadTestReport}
              disabled={downloadingReport}
              style={{
                ...secondaryBtn,
                opacity: downloadingReport ? 0.6 : 1,
                cursor: downloadingReport ? "default" : "pointer",
              }}
            >
              {downloadingReport ? "Preparing…" : "Download report (PDF)"}
            </button>
            {userData?.user?.programme === "PG" && (
              <button
                onClick={() => router.push(withFrom(`/dashboard/quiz/${quizId}/leaderboard`, currentUrl))}
                style={secondaryBtn}
              >
                Leaderboard
              </button>
            )}
            {quiz?.first_attempt_counts ? (
              <button
                onClick={() => router.push(withFrom(`/dashboard/quiz/${quizId}/practice`, currentUrl))}
                style={secondaryBtn}
              >
                Practice again
              </button>
            ) : quiz?.max_attempts == null || quiz?.max_attempts <= 0 || attemptsUsed + 1 < quiz.max_attempts ? (
              <button onClick={() => { setAttemptsUsed((n) => n + 1); setPhase("intro"); }} style={secondaryBtn}>
                Retake Quiz
              </button>
            ) : null}
          </div>
          {reportError && (
            <p style={{ color: "#b83232", fontSize: "13px", margin: "12px 0 0" }}>{reportError}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
