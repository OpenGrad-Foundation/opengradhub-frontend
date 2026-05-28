'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { useAuth } from '@clerk/nextjs';
import { submitQuizAttempt, advanceQuizSection, ApiError } from '@/lib/api';
import { listPendingSubmits, clearDraft, type QuizDraft } from '@/lib/quiz-draft';

// Skip drafts whose submit is likely still in flight in another tab.
const STALE_MS = 15_000;

/**
 * True when the server says this attempt is already submitted — meaning a prior
 * POST actually committed even though the client never saw the response. Safe to
 * clear the draft. The backend signals this with HTTP 400 + an "already
 * submitted" message (not 409), on both the full-submit and section-advance
 * paths, so match the message rather than the status alone.
 */
function isAlreadySubmitted(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.status === 409) return true;
  return e.status === 400 && /already\s+(been\s+)?submitted/i.test(e.message);
}

/**
 * Startup recovery for interrupted quiz submits. On app mount (once Clerk is
 * signed in) it scans IndexedDB for drafts whose submit POST was started but
 * never confirmed cleared — a crash or network drop mid-submit — and offers to
 * replay the saved payload. Treats a 409 as already-submitted (safe to clear).
 * Dismissing keeps the draft so answers are never silently discarded.
 */
export function QuizSubmitRecovery() {
  const { isLoaded, isSignedIn } = useAuth();
  const [pending, setPending] = useState<QuizDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    listPendingSubmits(STALE_MS)
      .then((list) => { if (!cancelled) setPending(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

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
      }
      await clearDraft(current.attempt_id).catch(() => {});
      setPending((p) => p.slice(1));
    } catch (e) {
      if (isAlreadySubmitted(e)) {
        // Server already has this submission — safe to clear and move on.
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
