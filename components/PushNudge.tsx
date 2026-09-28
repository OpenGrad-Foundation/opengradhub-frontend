'use client';

import { useEffect, useState } from 'react';
import { usePush } from '@/lib/push/use-push';

const DISMISS_KEY = 'push-nudge-dismissed';

/** One-time dismissible banner nudging staff to enable push. Renders nothing
 *  once dismissed, already subscribed, unsupported, or permission decided. */
export default function PushNudge() {
  const push = usePush();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  if (dismissed || !push.supported || push.subscribed || push.permission !== 'default') return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 16px', margin: '0 0 12px', background: 'rgba(10,190,98,0.08)', border: '1px solid rgba(10,190,98,0.25)', borderRadius: '12px', fontSize: '13px', color: '#034852' }}>
      <span>Get notified on your phone when tasks are assigned or blockers need you.</span>
      <span style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button type="button" onClick={() => void push.enable()} style={{ fontWeight: 700, color: '#fff', background: '#209379', border: 'none', borderRadius: '999px', padding: '4px 12px', cursor: 'pointer' }}>Enable</button>
        <button type="button" onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }} style={{ color: 'rgba(3,72,82,0.5)', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
      </span>
    </div>
  );
}
