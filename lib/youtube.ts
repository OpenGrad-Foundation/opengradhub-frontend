/**
 * Shared YouTube IFrame API plumbing.
 *
 * Extracted from the lesson player so the curriculum editor can reuse it to
 * read a video's length. The IFrame API is public and unkeyed — there is
 * deliberately no YouTube Data API key anywhere in this stack.
 */

// ── YouTube IFrame API type declarations ───────────────────────
// (Minimal — only what we use. Avoids a third-party @types package.)

declare global {
  interface Window {
    YT: {
      Player: new (
        element: string | HTMLElement,
        options: {
          videoId?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
            onError?: (e: { data: number; target: YTPlayer }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
    __openGradYoutubeIframeApiPromise?: Promise<void>;
  }
}

export interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

export const YT_API_SCRIPT_ID = "yt-api-script";
export const YT_API_READY_TIMEOUT_MS = 15000;

export function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube iframe API can only load in the browser."));
  }

  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (window.__openGradYoutubeIframeApiPromise) {
    return window.__openGradYoutubeIframeApiPromise;
  }

  window.__openGradYoutubeIframeApiPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let timeoutTimer: number | null = null;
    const handleError = () => fail();
    const existingScript = document.getElementById(YT_API_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    const cleanup = () => {
      if (pollTimer) window.clearInterval(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      script.removeEventListener("error", handleError);
    };

    const finish = () => {
      if (settled || !window.YT?.Player) return;
      settled = true;
      cleanup();
      resolve();
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      window.__openGradYoutubeIframeApiPromise = undefined;
      reject(new Error("YouTube iframe API failed to load."));
    };

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      finish();
    };

    if (!existingScript) {
      script.id = YT_API_SCRIPT_ID;
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }

    script.addEventListener("error", handleError, { once: true });
    pollTimer = window.setInterval(finish, 250);
    timeoutTimer = window.setTimeout(fail, YT_API_READY_TIMEOUT_MS);
  });

  return window.__openGradYoutubeIframeApiPromise;
}

/** Mirrors the server-side regex in course-content.service.ts. */
const YT_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractYoutubeId(url: string): string | null {
  return YT_ID_RE.exec(url.trim())?.[1] ?? null;
}

const DURATION_PROBE_TIMEOUT_MS = 10_000;
const DURATION_POLL_MS = 200;

/**
 * Read a video's length by briefly mounting an off-screen, never-played
 * IFrame player and asking it for getDuration().
 *
 * This is how the editor prefills a lesson's duration without a YouTube Data
 * API key. It fails soft (resolves null) — a duration is a display label, so a
 * private, deleted or embed-disabled video must never block saving a lesson.
 *
 * getDuration() reports 0 until the player has metadata, so poll rather than
 * trusting the first onReady read.
 */
export async function probeYoutubeDurationSeconds(videoId: string): Promise<number | null> {
  if (typeof window === "undefined") return null;

  try {
    await ensureYouTubeIframeApi();
  } catch {
    return null;
  }

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;pointer-events:none;";
  document.body.appendChild(host);

  return new Promise<number | null>((resolve) => {
    let settled = false;
    let player: YTPlayer | null = null;
    let pollTimer: number | null = null;
    let timeoutTimer: number | null = null;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      try { player?.destroy(); } catch { /* ignore */ }
      host.remove();
      resolve(value);
    };

    timeoutTimer = window.setTimeout(() => finish(null), DURATION_PROBE_TIMEOUT_MS);

    try {
      player = new window.YT.Player(host, {
        videoId,
        playerVars: { enablejsapi: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            pollTimer = window.setInterval(() => {
              const seconds = player?.getDuration() ?? 0;
              if (seconds > 0) finish(Math.round(seconds));
            }, DURATION_POLL_MS);
          },
          // 2 / 100 / 101 / 150 — bad id, private, or embedding disabled.
          onError: () => finish(null),
        },
      });
    } catch {
      finish(null);
    }
  });
}
