"use client";

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { isClerkMode } from '@/lib/auth-session';

const CAREER_MAP_SSO = 'https://careermap.opengrad.in/auth/hub';

// Signs the user in to Career Map. A fresh Clerk session token goes in a hidden form field of a
// top-level POST (never in a URL); Career Map verifies it, uses it once and opens its own session.
export default function CareerMapButton() {
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!isClerkMode()) return null;

  async function open() {
    setBusy(true);
    // skipCache: every click needs a new token, because Career Map refuses a token it has seen.
    const token = await getToken({ skipCache: true }).catch(() => null);
    if (!token) return setBusy(false);
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = CAREER_MAP_SSO;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token';
    input.value = token;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
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
