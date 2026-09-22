'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { usePush } from '@/lib/push/use-push';

const DISMISS_KEY = 'push-nudge-dismissed';

/** Offer once per browser; the bell menu remains available afterwards. */
export default function PushNudge() {
  const push = usePush();
  const [dismissed, setDismissed] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState('');
  const visible = !dismissed && push.supported && !push.subscribed && push.permission === 'default';

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      // If storage is unavailable, avoid a prompt we cannot remember showing.
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Remember the offer itself, including a reload or navigation away.
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* Current visit only. */ }
  }, [visible]);

  const dismiss = useCallback(() => setDismissed(true), []);

  async function enable() {
    setEnabling(true);
    setError('');
    try {
      await push.enable();
      dismiss();
    } catch {
      setError(typeof Notification !== 'undefined' && Notification.permission === 'denied'
        ? 'Notifications are blocked. Allow them in your browser settings, then use the bell menu to enable them.'
        : 'Notifications couldn’t be enabled. Try again, or enable them later from the bell menu.');
    } finally {
      setEnabling(false);
    }
  }

  if (!visible) return null;

  return createPortal(
    <Modal maxWidth="440px" onClose={dismiss} title={
      <div className="text-[var(--color-text)]">
        <Bell size={24} className="mb-4 text-[var(--teal)]" aria-hidden="true" />
        <h2 className="text-xl font-semibold leading-tight tracking-tight">Turn on task notifications</h2>
      </div>
    }>
      <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
        Get an alert when you’re assigned a task or a blocker needs your attention.
      </p>
      <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
        You can change this anytime from the bell menu.
      </p>
      {error && <p role="alert" className="mt-4 text-sm leading-relaxed text-[var(--color-text)]">{error}</p>}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <button type="button" onClick={() => void enable()} disabled={enabling} className="min-h-11 rounded-xl border border-[var(--green)] bg-[var(--green)] px-4 py-2.5 text-sm font-semibold text-[var(--dark-teal)] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)] disabled:cursor-wait disabled:opacity-60">
          {enabling ? 'Enabling…' : 'Enable notifications'}
        </button>
        <button type="button" onClick={dismiss} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-success-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--teal)]">
          Not now
        </button>
      </div>
    </Modal>,
    document.body,
  );
}
