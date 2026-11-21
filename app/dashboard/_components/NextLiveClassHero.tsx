"use client";

import { useEffect, useRef, useState } from "react";
import { VideoIcon } from "@/components/icons/ClassIcons";
import { joinLiveClass } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { openMeetingTab } from "@/lib/meeting-tab";
import { useNextLiveClass } from "@/lib/queries/live-classes";
import { retryAfterAt } from "@/lib/queries/retry";
import { useRetryCountdown } from "@/hooks/use-retry-countdown";
import WidgetError from "@/components/dashboard/primitives/WidgetError";

export default function NextLiveClassHero({ studentId }: { studentId: string }) {
  const nextClass = useNextLiveClass(studentId);
  const [now,       setNow]       = useState(0);
  const [joining,   setJoining]   = useState(false);
  const [joinedClassId, setJoinedClassId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<Error | null>(null);
  const joinWait = useRetryCountdown(retryAfterAt(joinError));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const invalidate = useInvalidate();

  // Countdown tick
  useEffect(() => {
    setNow(Date.now());
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const loadError = nextClass.failureReason ?? nextClass.error;
  if (loadError) {
    return (
      <div className="mb-6">
        <WidgetError
          message="Couldn't load your next live class."
          onRetry={() => void nextClass.refetch({ cancelRefetch: false })}
          retryAt={retryAfterAt(loadError)}
          isFetching={nextClass.isFetching}
        />
      </div>
    );
  }
  const liveClass = nextClass.data;
  if (!liveClass) return null;
  const joined = joinedClassId === liveClass.id;

  const scheduledMs = new Date(liveClass.scheduled_at).getTime();
  const endsMs      = scheduledMs + liveClass.duration_minutes * 60_000;
  const msUntil     = scheduledMs - now;
  const isLive      = now >= scheduledMs && now < endsMs;
  const canJoin     = msUntil <= 15 * 60_000 && now < endsMs;

  function countdown(ms: number): string {
    if (ms <= 0) return "Starting now";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1_000);
    if (h > 0)  return `${h}h ${m}m`;
    if (m >= 2) return `${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  function formatDatetime(iso: string) {
    const d = new Date(iso);
    return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  async function handleJoin(liveClassId: string) {
    if (joining || joinWait > 0) return;
    setJoining(true);
    setJoinError(null);
    try {
      let url = "";
      const opened = await openMeetingTab(async () => {
        url = (await joinLiveClass(liveClassId, studentId)).meeting_url;
        return url;
      });
      setJoinedClassId(liveClassId);
      // Popup blocked anyway: same-tab navigation needs no gesture.
      if (!opened) window.location.href = url;
      // For an online class this click IS the attendance mark, so the cached
      // attendance card sitting next to this one is now wrong.
      invalidate("liveClassAttendance");
    } catch (error) {
      setJoinError(error instanceof Error ? error : new Error("Could not join the live class."));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div style={{
      background: isLive
        ? "linear-gradient(135deg, #034852 0%, #006d6c 100%)"
        : "linear-gradient(135deg, rgba(3,72,82,0.92) 0%, rgba(0,109,108,0.92) 100%)",
      borderRadius: "24px",
      padding: "24px 28px",
      marginBottom: "24px",
      display: "flex",
      alignItems: "center",
      gap: "20px",
      boxShadow: "0 16px 40px rgba(3,72,82,0.25)",
      color: "#fff",
      flexWrap: "wrap",
    }}>
      {/* Live pulse */}
      <div style={{ flexShrink: 0 }}>
        {isLive ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", background: "rgba(229,62,62,0.9)", padding: "4px 10px", borderRadius: "100px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#fff", display: "inline-block", boxShadow: "0 0 0 3px rgba(255,255,255,0.3)" }} />
            LIVE
          </span>
        ) : (
          <VideoIcon className="h-7 w-7 text-[var(--teal)]" />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: "200px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.7, margin: "0 0 4px" }}>
          Your Next Live Session
        </p>
        <p style={{ fontFamily: "var(--font-heading)", fontSize: "18px", fontWeight: 700, margin: 0 }}>{liveClass.title}</p>
        <p style={{ fontSize: "13px", opacity: 0.75, margin: "4px 0 0" }}>
          {isLive ? `Live now · ends in ${countdown(endsMs - now)}` : formatDatetime(liveClass.scheduled_at)}
          {liveClass.duration_minutes && !isLive ? ` · ${liveClass.duration_minutes} min` : ""}
        </p>
      </div>

      {/* Countdown / join */}
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        {canJoin ? (
          <button
            onClick={() => void handleJoin(liveClass.id)}
            disabled={joining || joined || joinWait > 0}
            style={{
              padding: "10px 22px", border: "none", borderRadius: "10px",
              background: isLive ? "#0abe62" : "rgba(255,255,255,0.18)",
              color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
              fontSize: "14px", cursor: joining ? "default" : "pointer",
              opacity: joining ? 0.7 : 1, transition: "all 200ms ease",
              backdropFilter: "blur(8px)",
            }}
          >
            {joining ? "Opening…" : joined ? "Opened ✓" : isLive ? "Join Now →" : "Join Early →"}
          </button>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "11px", opacity: 0.6, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Starts in</p>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, margin: 0 }}>
              {countdown(msUntil)}
            </p>
          </div>
        )}
      </div>
      {joinError && (
        <p role="alert" className="w-full text-sm">
          {joinWait ? `Could not join yet. Try again in ${joinWait} s.` : joinError.message}
        </p>
      )}
    </div>
  );
}
