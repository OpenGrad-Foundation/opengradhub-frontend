"use client";

import { useEffect, useRef, useState } from "react";
import { getNextLiveClass, joinLiveClass, type LiveClass } from "@/lib/api";

export default function NextLiveClassHero({ studentId }: { studentId: string }) {
  const [cls,       setCls]       = useState<LiveClass | null | "loading">("loading");
  const [now,       setNow]       = useState(0);
  const [joining,   setJoining]   = useState(false);
  const [joined,    setJoined]    = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getNextLiveClass(studentId)
      .then(c => setCls(c))
      .catch(() => setCls(null));
  }, [studentId]);

  // Countdown tick
  useEffect(() => {
    setNow(Date.now());
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (cls === "loading" || cls === null) return null;

  const liveClass = cls;

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

  async function handleJoin() {
    setJoining(true);
    try {
      const { meeting_url } = await joinLiveClass(liveClass.id, studentId);
      setJoined(true);
      window.open(meeting_url, "_blank", "noopener,noreferrer");
    } catch { /* ignore */ } finally {
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
          <span style={{ fontSize: "28px" }}>🎥</span>
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
            onClick={() => void handleJoin()}
            disabled={joining || joined}
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
    </div>
  );
}
