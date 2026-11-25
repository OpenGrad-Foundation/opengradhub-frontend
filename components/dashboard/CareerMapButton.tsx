"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Compass, Loader2 } from 'lucide-react';
import { isClerkMode } from '@/lib/auth-session';

const CAREER_MAP_SSO = 'https://careermap.opengrad.in/auth/hub';

// Sidebar item that signs the user in to Career Map. A fresh Clerk session token is sent as a form
// field of a top-level POST (never in a URL); Career Map verifies it, uses it once and opens its own
// session. Styled like the other sidebar links (components/sidebar.tsx renderLeaf).
export default function CareerMapButton({ collapsed = false }: { collapsed?: boolean }) {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);

  // Coming Back from Career Map can restore this page from the back-forward cache mid-"busy".
  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  if (!isClerkMode()) return null;

  async function open() {
    setBusy(true);
    // skipCache: every click needs a new token, because Career Map refuses a token it has seen.
    const token = await getToken({ skipCache: true }).catch(() => null);
    if (!token) return setBusy(false);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = CAREER_MAP_SSO;
    // The token is added only to the outgoing form data, never to the DOM, so session replay
    // (Sentry) can't record it.
    form.setAttribute('data-sentry-block', '');
    form.addEventListener('formdata', (e) => e.formData.set('token', token));
    document.body.appendChild(form);
    form.requestSubmit();
    form.remove();
  }

  const Icon = busy ? Loader2 : Compass;
  return (
    <li>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        title={collapsed ? 'Career Map' : undefined}
        className={
          'relative flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-[var(--dark-teal)] disabled:opacity-60 ' +
          (collapsed ? 'lg:gap-0 lg:px-0 lg:justify-center' : '')
        }
      >
        <Icon size={18} className={'text-gray-400' + (busy ? ' animate-spin' : '')} aria-hidden="true" />
        <span className={collapsed ? 'lg:hidden' : ''}>{busy ? 'Opening…' : 'Career Map'}</span>
      </button>
    </li>
  );
}
