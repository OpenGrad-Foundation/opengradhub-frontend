'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '@clerk/nextjs';
import { submitQuizAttempt, advanceQuizSection } from '@/lib/api';
import { listPendingSubmits, clearDraft, type QuizDraft } from '@/lib/quiz-draft';
import { isTerminalSubmitError } from '@/lib/quiz-submit-recovery';
import { useInvalidate } from '@/lib/mutations/invalidation';

// Skip drafts whose submit is likely still in flight in another tab.
const MIN_AGE_MS = 15_000;

// A submit still pending after a week will never be accepted (the attempt is
// long past its deadline, reset, or gone). Prompting for it forever is worse
// than dropping it, so drafts older than this are pruned instead of offered.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Startup recovery for interrupted quiz submits. On app mount (once Clerk is
 * signed in) it scans IndexedDB for this user's drafts whose submit POST was
 * started but never confirmed cleared — a crash or network drop mid-submit —
 * and offers to replay the saved payload. Errors the server will never accept
 * (see isTerminalSubmitError) clear the draft instead of re-prompting.
 * Dismissing keeps the draft so answers are never silently discarded.
 */
export function QuizSubmitRecovery() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [pending, setPending] = useState<QuizDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;
    // Scoped to this account: drafts saved by another user on this browser can
    // never be replayed, so offering them would prompt on every launch forever.
    listPendingSubmits({ userId, minAgeMs: MIN_AGE_MS, maxAgeMs: MAX_AGE_MS })
      .then((list) => { if (!cancelled) setPending(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, userId]);

  if (pending.length === 0) return null;
  const current = pending[0];

  async function handleSubmitNow() {
    setBusy(true);
    setErr(null);
    try {
      const payload = current.submit_payload ?? [];
      if (current.submit_kind === 'section') {
        await advanceQuizSection(current.attempt_id, payload);
      } else {
        await submitQuizAttempt(current.attempt_id, payload);
        invalidate('quizAttempt');
      }
      await clearDraft(current.attempt_id).catch(() => {});
      setPending((p) => p.slice(1));
    } catch (e) {
      if (isTerminalSubmitError(e)) {
        // Server rejected this submission terminally (already submitted, time up,
        // gone, or not ours) — safe to clear and move on.
        await clearDraft(current.attempt_id).catch(() => {});
        setPending((p) => p.slice(1));
      } else {
        setErr(e instanceof Error ? e.message : 'Submit failed. Please try again later.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    // Keep the IDB draft so it re-prompts next launch — never silently discard answers.
    setErr(null);
    setPending((p) => p.slice(1));
  }

  const when = current.submit_pending_at
    ? new Date(current.submit_pending_at).toLocaleString()
    : '';

  return (
    <div style={overlay} role="dialog" aria-modal="true">
      <div style={modal}>
        <p style={title}>Unsubmitted quiz</p>
        <p style={body}>
          A quiz attempt was being submitted{when ? ` on ${when}` : ''} but never
          confirmed. Submit it now so your answers are recorded?
        </p>
        {err && <p style={errText}>{err}</p>}
        <div style={row}>
          <button onClick={() => void handleSubmitNow()} disabled={busy} style={primary}>
            {busy ? 'Submitting…' : 'Submit now'}
          </button>
          <button onClick={handleDismiss} disabled={busy} style={secondary}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(3,72,82,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '16px',
};

const modal: CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  padding: '24px',
  maxWidth: '420px',
  width: '100%',
  boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
};

const title: CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: 'var(--dark-teal, #034852)',
  marginBottom: '8px',
};

const body: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.5,
  color: 'rgba(3,72,82,0.78)',
};

const errText: CSSProperties = {
  fontSize: '13px',
  color: '#e53e3e',
  marginTop: '10px',
};

const row: CSSProperties = {
  display: 'flex',
  gap: '10px',
  marginTop: '20px',
};

const primary: CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg,#0abe62,#209379)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
};

const secondary: CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: '10px',
  border: '1.5px solid rgba(3,72,82,0.2)',
  background: '#fff',
  color: 'var(--dark-teal, #034852)',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
};
