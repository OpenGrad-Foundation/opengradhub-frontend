"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  getQuizById,
  startQuizAttempt,
  submitQuizAttempt,
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
} from "@/lib/api";
import { MathContent } from "@/app/dashboard/_components/MathContent";
import { QuestionView, type AnswerMap } from "@/components/question-view";
import { loadDraft, saveDraft, clearDraft, type QuizDraft } from "@/lib/quiz-draft";
import { computeSectionStats, type SectionStats } from "@/lib/section-stats";
import { Calculator } from "@/components/calculator";

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
  background: "#f0f2f5",
  fontFamily: "'Inter', sans-serif",
  color: "#034852",
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
  fontFamily: "'Inter', sans-serif",
  color: "#034852",
};

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 2px 24px rgba(3,72,82,0.08)",
  marginBottom: "20px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: "#034852",
  margin: "0 0 8px",
};

const subtext: React.CSSProperties = {
  fontSize: "14px",
  color: "rgba(3,72,82,0.6)",
};

const pill: React.CSSProperties = {
  display: "inline-block",
  background: "rgba(10,190,98,0.1)",
  color: "#0abe62",
  borderRadius: "9999px",
  padding: "3px 12px",
  fontSize: "12px",
  fontWeight: 700,
  marginRight: "8px",
};

const primaryBtn: React.CSSProperties = {
  background: "linear-gradient(135deg,#0abe62,#209379)",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 28px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "rgba(3,72,82,0.08)",
  color: "#034852",
  border: "none",
  borderRadius: "12px",
  padding: "12px 28px",
  fontSize: "15px",
  fontWeight: 700,
  cursor: "pointer",
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
    <div style={{ marginTop: "24px", padding: "20px 24px", background: "rgba(3,72,82,0.03)", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(3,72,82,0.5)", margin: 0 }}>
          Time per question
        </p>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#209379" }}>Total {fmtTime(total)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#034852", width: "72px", flexShrink: 0 }}>{r.label}</span>
            <div style={{ flex: 1, height: "8px", borderRadius: "100px", background: "rgba(3,72,82,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.seconds / max) * 100}%`, borderRadius: "100px", background: "linear-gradient(135deg,#0abe62,#209379)" }} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(3,72,82,0.6)", width: "64px", textAlign: "right", flexShrink: 0 }}>
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
  const { data: userData, isLoading: userLoading } = useCurrentUser();

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

  // Count-up / countdown timer
  useEffect(() => {
    if (phase !== "taking") return;
    const iv = setInterval(() => setTimeElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Auto-submit when time limit reached
  const timeLimitSeconds = quiz?.duration_minutes ? quiz.duration_minutes * 60 : null;
  useEffect(() => {
    if (phase !== "taking" || !timeLimitSeconds || submittingRef.current) return;
    if (timeElapsed >= timeLimitSeconds) void handleSubmitRef.current();
  }, [timeElapsed, timeLimitSeconds, phase]);

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

  // Debounced autosave of in-progress answers to IndexedDB.
  useEffect(() => {
    if (phase !== "taking" || !attempt) return;
    const activeSectionMeta = currentSectionIdx != null ? sections[currentSectionIdx] : null;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      void saveDraft({
        attempt_id: attempt.attempt_id,
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
  }, [answers, flagged, currentIdx, phase, attempt, sections, currentSectionIdx, quiz?.is_sectioned, quiz?.sequential_sections]);

  useEffect(() => {
    if (userLoading || !userData || hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    if (userData.role.code !== "STUDENT") {
      setError("Only students can take quizzes.");
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

      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(started.started_at).getTime()) / 1000));

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
        sectionStartRef.current = Date.now();
      }
      setAnswers(draft?.answers ?? {});
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
      retrySubmitRef.current = () => { void handleSubmit(); };
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
          <p style={{ ...heading, color: "#e53e3e" }}>Error</p>
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
            onClick={() => router.back()}
            style={retrySubmitRef.current ? secondaryBtn : primaryBtn}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (phase === "intro" && quiz) {
    const exhausted = quiz.max_attempts != null && attemptsUsed >= quiz.max_attempts;
    return (
      <div style={pageCentered}>
        <a
          href="/dashboard/assessments"
          style={{ fontSize: "13px", color: "#209379", fontWeight: 600, textDecoration: "none", display: "block", marginBottom: "20px" }}
        >
          ← Back to Assessments
        </a>
        <div style={card}>
          <p style={{ ...subtext, marginBottom: "6px" }}>
            {quiz.quiz_type === "MODULE_TEST" ? "Module Test" : "Global Test"}
          </p>
          <h1 style={heading}>{quiz.title}</h1>
          <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {quiz.duration_minutes && <span style={pill}>⏱ {quiz.duration_minutes} min</span>}
            {quiz.max_attempts && (
              <span style={pill}>
                {attemptsUsed}/{quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? "s" : ""} used
              </span>
            )}
            {quiz.pass_threshold_percent && (
              <span style={pill}>Pass: {quiz.pass_threshold_percent}%</span>
            )}
            <span style={pill}>{quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""}</span>
          </div>
          {(() => {
            const fsRequired = !!quiz?.require_fullscreen;
            const fsSupported = typeof document !== "undefined" && !!document.fullscreenEnabled;
            const fsBlockMobile = fsRequired && !fsSupported;
            if (fsBlockMobile) {
              return (
                <p style={{ ...subtext, marginTop: "20px", color: "#e53e3e", fontWeight: 600 }}>
                  This quiz requires fullscreen mode, which isn&apos;t supported on this device. Please use a desktop browser (Chrome / Edge / Firefox) to take this quiz.
                </p>
              );
            }
            return exhausted && !incompleteAttempt ? (
              <p style={{ ...subtext, marginTop: "20px", color: "#e53e3e" }}>
                You have used all available attempts for this quiz.
              </p>
            ) : (
              <button onClick={handleStart} style={{ ...primaryBtn, marginTop: "20px" }}>
                {incompleteAttempt
                  ? "Resume Attempt"
                  : attemptsUsed > 0
                    ? "Retake Quiz"
                    : "Start Quiz"} →
              </button>
            );
          })()}

          {pastAttempts.length > 0 && (
            <div style={{ marginTop: "28px", borderTop: "1px solid rgba(3,72,82,0.08)", paddingTop: "20px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(3,72,82,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                Past Attempts
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {pastAttempts.map((a) => {
                  const pct = a.score != null && a.max_score ? Math.round((a.score / a.max_score) * 100) : null;
                  const date = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "rgba(3,72,82,0.03)", borderRadius: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852" }}>
                          Attempt {a.attempt_number} — {a.score ?? "?"}/{a.max_score ?? "?"}{pct !== null ? ` (${pct}%)` : ""}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>{date}</p>
                      </div>
                      {a.passed !== null && (
                        <span style={{ fontSize: "12px", fontWeight: 700, padding: "3px 10px", borderRadius: "100px", background: a.passed ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.1)", color: a.passed ? "#0abe62" : "#e53e3e" }}>
                          {a.passed ? "Passed" : "Failed"}
                        </span>
                      )}
                      <span style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "100px",
                        background: a.counts_toward_grade ? "rgba(10,190,98,0.1)" : "rgba(3,72,82,0.08)",
                        color:      a.counts_toward_grade ? "#0abe62" : "rgba(3,72,82,0.6)",
                      }}>
                        {a.counts_toward_grade ? "Counted" : "Practice"}
                      </span>
                      {quiz?.show_answers_after && (
                        <button
                          onClick={() => router.push(`/dashboard/quiz/${quizId}/review/${a.id}`)}
                          style={{ ...secondaryBtn, padding: "6px 14px", fontSize: "13px" }}
                        >
                          Review →
                        </button>
                      )}
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
                borderTopColor: "#0abe62",
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
            background: "rgba(229,62,62,0.95)",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
            color: "#fff", padding: "40px", textAlign: "center",
          }}>
            <h2 style={{ fontSize: "32px", margin: 0, marginBottom: "16px" }}>Fullscreen Exited</h2>
            <p style={{ fontSize: "16px", margin: 0, marginBottom: "24px", maxWidth: "500px", lineHeight: 1.6 }}>
              This quiz requires fullscreen mode. The exit has been logged. Return to fullscreen to continue.
            </p>
            <button
              onClick={async () => {
                try { await document.documentElement.requestFullscreen(); } catch { /* user gesture failed */ }
              }}
              style={{
                padding: "12px 28px", borderRadius: "12px",
                background: "#fff", color: "#e53e3e",
                fontSize: "16px", fontWeight: 700, border: "none", cursor: "pointer",
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
            <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "420px", width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "#034852", margin: "0 0 12px" }}>Reload this page?</p>
              <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.65)", margin: "0 0 24px", lineHeight: 1.6 }}>
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
              background: "#fff", borderRadius: "16px",
              padding: "28px", maxWidth: "480px", width: "100%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            }}>
              <p style={{ fontSize: "18px", fontWeight: 800, color: "#034852", margin: "0 0 12px" }}>
                {confirmModal.title}
              </p>
              <p style={{
                fontSize: "14px", color: "rgba(3,72,82,0.75)",
                margin: "0 0 24px", lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}>
                {confirmModal.body}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setConfirmModal(null)}
                  style={{ ...secondaryBtn, padding: "10px 20px", fontSize: "14px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const fn = confirmModal.onConfirm;
                    setConfirmModal(null);
                    fn();
                  }}
                  style={{ ...primaryBtn, padding: "10px 20px", fontSize: "14px" }}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={pageInner}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "#034852", margin: 0 }}>{quiz?.title}</p>
            <span style={{ ...pill, background: "rgba(3,72,82,0.08)", color: "#034852", margin: 0 }}>
              Attempt #{attempt.attempt_number}
            </span>
          </div>

          {/* Section tab header (when sectioned) */}
          {quiz?.is_sectioned && sections.length > 0 && (
            <div style={{
              display: "flex",
              gap: "4px",
              marginBottom: "16px",
              borderBottom: "2px solid rgba(3,72,82,0.08)",
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
                      fontWeight: 700,
                      background: isActive ? "#fff" : "transparent",
                      color: isActive ? "#0abe62" : (isLocked || isPending) ? "rgba(3,72,82,0.35)" : "#034852",
                      borderBottom: `3px solid ${isActive ? "#0abe62" : "transparent"}`,
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
                        {stats.flagged > 0 ? ` ⚑${stats.flagged}` : ""}
                      </span>
                    )}
                    {isLocked && <span style={{ fontSize: "11px" }}>🔒</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Two-column layout */}
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            {/* Main question card */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={card}>
                {/* Question header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#034852" }}>
                    Question {currentIdx + 1} of {total}
                  </p>
                  <button
                    onClick={() => toggleFlag(q.snapshot_id)}
                    style={{
                      background: isFlagged ? "rgba(229,62,62,0.1)" : "rgba(3,72,82,0.06)",
                      color: isFlagged ? "#e53e3e" : "rgba(3,72,82,0.5)",
                      border: "none",
                      borderRadius: "8px",
                      padding: "6px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    ⚑ {isFlagged ? "Flagged" : "Flag"}
                  </button>
                </div>

                {/* Question body */}
                <QuestionView
                  q={q}
                  answers={answers}
                  setAnswer={setAnswer}
                />

                {/* Navigation */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "32px",
                  paddingTop: "20px",
                  borderTop: "1px solid rgba(3,72,82,0.08)",
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
                    ‹ Previous
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
                            : "Submit Section →"}
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
                        ? "Next Section →"
                        : "Next ›"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ width: "220px", flexShrink: 0 }}>
              <div style={{ ...card, padding: "20px", marginBottom: "12px" }}>
                {/* Timer */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "20px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid rgba(3,72,82,0.08)",
                }}>
                  {quiz?.sequential_sections && sectionRemaining != null ? (
                    <span style={{ fontWeight: 700, color: sectionRemaining < 60 ? "#e53e3e" : "#034852" }}>
                      ⏱ Section: {Math.floor(sectionRemaining / 60)}:{(sectionRemaining % 60).toString().padStart(2, "0")}
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: "18px", color: timerIsLow ? "#e53e3e" : "#034852" }}>⏱</span>
                      <span style={{
                        fontSize: "22px",
                        fontWeight: 800,
                        color: timerIsLow ? "#e53e3e" : "#034852",
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
                      background: "rgba(3,72,82,0.04)",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    }}>
                      <p style={{
                        margin: 0,
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "rgba(3,72,82,0.6)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}>{title}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px", fontSize: "13px", color: "#034852" }}>
                        <span><strong>{showStats.answered}</strong> Answered</span>
                        <span><strong>{showStats.unanswered}</strong> Unanswered</span>
                        <span><strong>{showStats.flagged}</strong> Flagged</span>
                        <span><strong>{showStats.flaggedAndAnswered}</strong> Flagged + Answered</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Question navigator grid */}
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#034852", margin: "0 0 12px" }}>Questions</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
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
                          aspectRatio: "1",
                          borderRadius: "8px",
                          border: "none",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                          position: "relative",
                          background: isCurrent
                            ? "#034852"
                            : status === "answered"
                              ? "rgba(10,190,98,0.15)"
                              : "rgba(3,72,82,0.06)",
                          color: isCurrent
                            ? "#fff"
                            : status === "answered"
                              ? "#0abe62"
                              : "rgba(3,72,82,0.45)",
                          outline: isQFlagged ? "2px solid #e53e3e" : "none",
                          outlineOffset: "2px",
                        }}
                      >
                        {i + 1}
                        {isQFlagged && (
                          <span style={{ position: "absolute", top: "2px", right: "3px", fontSize: "8px", color: "#e53e3e", lineHeight: 1 }}>⚑</span>
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
                      padding: "10px 16px",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      opacity: advancingSection ? 0.6 : 1,
                    }}
                  >
                    {advancingSection
                      ? "Submitting…"
                      : currentSectionIdx != null && currentSectionIdx >= sections.length - 1
                        ? "Submit Final Section"
                        : "Submit Section →"}
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
                      padding: "10px 16px",
                      fontSize: "14px",
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
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    background: calcOpen ? "#034852" : "rgba(3,72,82,0.06)",
                    color: calcOpen ? "#fff" : "#034852",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                  aria-expanded={calcOpen}
                  aria-label="Toggle calculator"
                >
                  🧮 Calculator
                </button>
                {calcOpen && <Calculator style={{ marginTop: "12px" }} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    const pct = result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : null;
    return (
      <div style={pageCentered}>
        <div style={card}>
          <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", color: "#0abe62", marginBottom: "12px" }}>
            Quiz Complete
          </p>
          <h1 style={{ ...heading, fontSize: "28px" }}>{quiz?.title}</h1>

          <div style={{ marginTop: "28px", padding: "24px", background: "rgba(3,72,82,0.04)", borderRadius: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "48px", fontWeight: 900, color: "#034852", margin: 0 }}>
              {result.score}/{result.max_score}
            </p>
            {pct !== null && (
              <p style={{ fontSize: "20px", color: "rgba(3,72,82,0.6)", margin: "4px 0 0" }}>{pct}%</p>
            )}
            {result.passed !== null && (
              <p style={{
                fontSize: "18px", fontWeight: 800, marginTop: "12px",
                color: result.passed ? "#0abe62" : "#e53e3e",
              }}>
                {result.passed ? "Passed" : "Not Passed"}
              </p>
            )}
          </div>

          {attempt && <TimingBreakdown questions={attempt.questions} timings={timingsRef.current} />}

          {explanations.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(3,72,82,0.5)", margin: "0 0 16px" }}>
                Explanation Videos ({explanations.length} wrong answer{explanations.length !== 1 ? "s" : ""})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {explanations.map((ex, i) => {
                  const embedUrl = getYouTubeEmbedUrl(ex.explanation_video_url);
                  if (!embedUrl) return null;
                  return (
                    <div key={ex.snapshot_id} style={{ padding: "16px", background: "rgba(229,62,62,0.04)", borderRadius: "12px", border: "1px solid rgba(229,62,62,0.12)" }}>
                      <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: 700, color: "#e53e3e", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Wrong answer #{i + 1}
                      </p>
                      <MathContent html={ex.content_html} style={{ fontSize: "14px", fontWeight: 600, color: "#034852", marginBottom: "12px", lineHeight: 1.5 }} />
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

          <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
            <button onClick={() => router.push("/dashboard/assessments")} style={primaryBtn}>
              Back to Assessments
            </button>
            {result.show_answers_after && (
              <button
                onClick={() => router.push(`/dashboard/quiz/${quizId}/review/${result.attempt_id}`)}
                style={secondaryBtn}
              >
                Review Answers →
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
                onClick={() => router.push(`/dashboard/quiz/${quizId}/leaderboard`)}
                style={secondaryBtn}
              >
                Leaderboard
              </button>
            )}
            {quiz?.first_attempt_counts ? (
              <button
                onClick={() => router.push(`/dashboard/quiz/${quizId}/practice`)}
                style={secondaryBtn}
              >
                Practice again
              </button>
            ) : quiz?.max_attempts == null || attemptsUsed + 1 < (quiz?.max_attempts ?? Infinity) ? (
              <button onClick={() => { setAttemptsUsed((n) => n + 1); setPhase("intro"); }} style={secondaryBtn}>
                Retake Quiz
              </button>
            ) : null}
          </div>
          {reportError && (
            <p style={{ color: "#e53e3e", fontSize: "13px", margin: "12px 0 0" }}>{reportError}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
