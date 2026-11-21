'use client';

import { useClerk } from '@clerk/nextjs';
import { clearUserCache, type useCurrentUser } from '@/hooks/use-current-user';
import { useRetryCountdown } from '@/hooks/use-retry-countdown';
import { clearStoredAuthToken, isClerkMode } from '@/lib/auth-session';

export default function ProfileError({ profile }: { profile: ReturnType<typeof useCurrentUser> }) {
  const clerk = useClerk();
  const seconds = useRetryCountdown(profile.retryAt);
  const backToLogin = profile.errorKind === 'session' || profile.errorKind === 'not-provisioned';
  const transient = profile.errorKind === 'transient';

  async function handleBackToLogin() {
    if (isClerkMode()) await clerk.signOut();
    else clearStoredAuthToken();
    await clearUserCache();
    window.location.replace('/');
  }

  let message = profile.error ?? 'Could not load your OpenGradHub profile.';
  if (transient && profile.isFetching) {
    message = seconds ? `Server is busy, retrying in ${seconds} s…` : 'Server is busy, retrying…';
  } else if (transient && seconds) {
    message = `Server is busy. Try again in ${seconds} s.`;
  } else if (transient) {
    message = 'Server is busy. Please try again.';
  }

  return (
    <div className="rounded-3xl border border-[rgba(3,72,82,0.08)] bg-white px-6 py-5 text-center shadow-sm">
      <p role="status" className="text-sm text-[#034852]">{message}</p>
      {profile.errorKind !== 'forbidden' && (
        <button
          type="button"
          onClick={backToLogin ? handleBackToLogin : profile.retry}
          disabled={!backToLogin && (profile.isFetching || seconds > 0)}
          className="mt-3 rounded-xl bg-[#006d6c] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {backToLogin ? 'Back to login' : profile.errorKind === 'signed-out' ? 'Reload' : 'Retry'}
        </button>
      )}
    </div>
  );
}
