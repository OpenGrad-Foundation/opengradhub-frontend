'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { API_BASE_URL } from '../api';
import { isClerkMode, getStoredAuthToken } from '../auth-session';
import { useInvalidate } from '../mutations/invalidation';
import { createRealtimeRouter } from './router';

/** A 4xx (≠429) at connect means auth/permission failure — stop, don't retry. */
class FatalError extends Error {}

const MIN_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Opens one SSE stream to GET /events/stream and invalidates React Query caches
 * when the server signals a change — replacing the old 30s polling of
 * notifications/announcements.
 *
 * @microsoft/fetch-event-source (not native EventSource) so we can send the
 * Authorization: Bearer header. We run our OWN reconnect loop (the lib's
 * internal retry reuses stale headers): each (re)connect mints a FRESH token, so
 * the server's periodic force-close cycles a new token in cleanly.
 *
 * Mount once, high in the authenticated tree (DashboardTopbar). Pass enabled to
 * gate on having an authenticated user.
 */
export function useRealtime(enabled: boolean): void {
  const invalidate = useInvalidate();
  const clerkAuth = useAuth();
  const clerkMode = isClerkMode();

  // Refs keep the effect stable (deps: [enabled]) so re-renders don't tear down
  // and reopen the stream. Always read the latest token getter / invalidator.
  const tokenRef = useRef<() => Promise<string | null>>(async () => null);
  tokenRef.current = async () => {
    if (clerkMode) {
      try {
        return await clerkAuth.getToken();
      } catch {
        return null;
      }
    }
    return getStoredAuthToken();
  };

  const invalidateRef = useRef(invalidate);
  invalidateRef.current = invalidate;

  useEffect(() => {
    if (!enabled) return;

    const ctrl = new AbortController();
    let stopped = false;

    const router = createRealtimeRouter({
      invalidateNotifications: () => invalidateRef.current('notifications'),
      invalidateAnnouncements: () => invalidateRef.current('announcements'),
    });

    async function run() {
      let backoff = MIN_BACKOFF_MS;
      while (!stopped) {
        const token = await tokenRef.current();
        if (!token) {
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          continue;
        }
        try {
          await fetchEventSource(`${API_BASE_URL}/events/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
            // Keep the stream open while the tab is hidden. With the library's
            // visibility handling (openWhenHidden:false) it would silently
            // re-open on tab-focus reusing THIS connection's original token; if
            // the tab was hidden past the token TTL, that reopen 401s → fatal →
            // SSE dies permanently. Staying open means our own loop + the
            // server's 30min force-close drive every reconnect with a fresh
            // token. An idle SSE socket is cheap — the goal is fewer requests,
            // not fewer sockets.
            openWhenHidden: true,
            async onopen(res) {
              const contentType = res.headers.get('content-type') ?? '';
              if (res.ok && contentType.includes('text/event-stream')) {
                backoff = MIN_BACKOFF_MS; // healthy connect → reset backoff
                return;
              }
              if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                throw new FatalError(`SSE auth failed: ${res.status}`);
              }
              throw new Error(`SSE open failed: ${res.status}`);
            },
            onmessage(ev) {
              router.handle(ev.event);
            },
            onclose() {
              // Server force-closed (token-refresh cycle) → reconnect.
              throw new Error('SSE closed');
            },
            onerror(err) {
              // Throw to STOP the lib's internal retry; our loop reconnects with
              // a fresh token. Rethrowing FatalError stops permanently.
              throw err;
            },
          });
          // Resolved without throwing → the signal was aborted. Done.
          return;
        } catch (err) {
          if (stopped || ctrl.signal.aborted) return;
          if (err instanceof FatalError) return; // 401/403 → don't hammer
          await sleep(backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      }
    }

    void run();

    return () => {
      stopped = true;
      ctrl.abort();
      router.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
