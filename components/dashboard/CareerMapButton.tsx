"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { isClerkMode } from '@/lib/auth-session';

const CAREER_MAP_SSO = 'https://careermap.opengrad.in/auth/hub';

// Signs the user in to Career Map. A fresh Clerk session token is sent as a form field of a
// top-level POST (never in a URL); Career Map verifies it, uses it once and opens its own session.
export default function CareerMapButton() {
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

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="rounded-xl bg-[#006d6c] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
    >
      {busy ? 'Opening Career Map…' : 'Career Map'}
    </button>
  );
}
