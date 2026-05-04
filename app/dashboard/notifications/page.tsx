"use client";

import { useEffect, useState, useCallback } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getNotifications, markAllNotificationsRead, type Notification } from "@/lib/api";

function typeIcon(type: string): string {
  if (type.includes("assignment") || type.includes("ASSIGNMENT")) return "📝";
  if (type.includes("live")       || type.includes("LIVE"))       return "🎥";
  if (type.includes("grade")      || type.includes("GRADE"))      return "✅";
  if (type.includes("announce")   || type.includes("ANNOUNCE"))   return "📢";
  if (type.includes("warning")    || type.includes("WARNING"))    return "⚠️";
  return "🔔";
}

export default function NotificationsPage() {
  const { data: userData, isLoading } = useCurrentUser();
  const userId = userData?.user?.id ?? "";

  const [items,   setItems]   = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setItems(await getNotifications(userId));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (!isLoading && userId) void fetch(); }, [isLoading, userId, fetch]);

  async function handleMarkAll() {
    setMarking(true);
    await markAllNotificationsRead(userId).catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarking(false);
  }

  const unreadCount = items.filter(n => !n.is_read).length;

  return (
    <div style={{ maxWidth: "680px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
        <div>
          <p style={S.label}>Inbox</p>
          <h1 style={{ ...S.heading, fontSize: "26px", margin: "4px 0 0" }}>Notifications</h1>
          {unreadCount > 0 && (
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.55)", marginTop: "4px" }}>
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void handleMarkAll()}
            disabled={marking}
            style={{ ...S.outlineBtn, opacity: marking ? 0.6 : 1 }}
          >
            {marking ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "40px" }}>
          <p style={S.label}>Loading</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ fontSize: "32px", marginBottom: "8px" }}>🔔</p>
          <p style={{ ...S.heading, fontSize: "18px", margin: 0 }}>All caught up</p>
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", marginTop: "8px" }}>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ ...glassCard, padding: 0, overflow: "hidden" }}>
          {items.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: "flex", gap: "14px", padding: "16px 24px",
                borderBottom: i < items.length - 1 ? "1px solid rgba(3,72,82,0.06)" : "none",
                background: n.is_read ? "transparent" : "rgba(10,190,98,0.03)",
                transition: "background 150ms",
              }}
            >
              <span style={{ fontSize: "20px", flexShrink: 0, marginTop: "2px" }}>{typeIcon(n.type)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852", lineHeight: 1.3 }}>{n.title}</p>
                  <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.4)", flexShrink: 0 }}>
                    {new Date(n.triggered_at).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                    {new Date(n.triggered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(3,72,82,0.65)", lineHeight: 1.5 }}>{n.body}</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", alignItems: "center" }}>
                  <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "6px", background: "rgba(3,72,82,0.06)", color: "rgba(3,72,82,0.5)", fontWeight: 600, letterSpacing: "0.04em" }}>
                    {n.channel}
                  </span>
                  {!n.is_read && (
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#0abe62" }} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const glassCard: React.CSSProperties = { background: "rgba(255,255,255,0.7)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "24px", boxShadow: "0 32px 64px rgba(0,0,0,0.08)" };
const S = {
  label:      { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading:    { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  outlineBtn: { padding: "8px 16px", border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "12px", cursor: "pointer" } as React.CSSProperties,
};
