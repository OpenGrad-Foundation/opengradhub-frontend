"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getNotifications,
  markAllNotificationsRead,
  type Notification,
} from "@/lib/api";
import { useInboxUnreadCount } from "@/lib/queries/inbox";

// ── Type icon map ──────────────────────────────────────────────

function typeIcon(type: string): string {
  if (type.includes("assignment") || type.includes("ASSIGNMENT")) return "📝";
  if (type.includes("live")       || type.includes("LIVE"))       return "🎥";
  if (type.includes("grade")      || type.includes("GRADE"))      return "✅";
  if (type.includes("announce")   || type.includes("ANNOUNCE"))   return "📢";
  if (type.includes("warning")    || type.includes("WARNING"))    return "⚠️";
  return "🔔";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  const hrs  = Math.floor(min  / 60);
  const days = Math.floor(hrs  / 24);
  if (min  < 1)  return "Just now";
  if (min  < 60) return `${min}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

// ── Component ──────────────────────────────────────────────────

export default function NotificationBell({ recipientId }: { recipientId: string }) {
  const { data: unreadData } = useInboxUnreadCount(recipientId);
  const count = unreadData?.count ?? 0;

  const [items,    setItems]    = useState<Notification[]>([]);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const data = await getNotifications(recipientId);
      setItems(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function handleMarkAll() {
    // Optimistic: flip the list to read immediately, then confirm with the server.
    // The badge count is derived from useInboxUnreadCount hook and will update
    // on next poll cycle. Restore local list state on failure.
    const snapshot = items;
    setItems(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead(recipientId);
    } catch {
      setItems(snapshot);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => void handleOpen()}
        style={{
          position: "relative", background: "none", border: "none",
          cursor: "pointer", padding: "6px", borderRadius: "10px",
          color: "#034852", fontSize: "20px", lineHeight: 1,
          transition: "background 150ms",
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        🔔
        {count > 0 && (
          <span style={{
            position: "absolute", top: "2px", right: "2px",
            minWidth: "16px", height: "16px", borderRadius: "8px",
            background: "#e53e3e", color: "#fff",
            fontSize: "9px", fontWeight: 700, lineHeight: "16px",
            textAlign: "center", padding: "0 3px",
            boxShadow: "0 0 0 2px #fff",
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: "340px",
          background: "rgba(255,255,255,0.97)",
          border: "1px solid rgba(3,72,82,0.1)", borderRadius: "18px",
          boxShadow: "0 16px 48px rgba(3,72,82,0.15)",
          zIndex: 100, overflow: "hidden",
        }}>
          {/* Dropdown header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 10px" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#034852" }}>
              Notifications {count > 0 && <span style={{ fontSize: "11px", color: "#e53e3e", marginLeft: "4px" }}>({count} unread)</span>}
            </p>
            {count > 0 && (
              <button
                onClick={() => void handleMarkAll()}
                style={{ background: "none", border: "none", fontSize: "11px", color: "#209379", fontWeight: 700, cursor: "pointer", padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            {loading ? (
              <p style={{ textAlign: "center", padding: "20px", fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ textAlign: "center", padding: "24px", fontSize: "13px", color: "rgba(3,72,82,0.4)" }}>No notifications yet</p>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  style={{
                    display: "flex", gap: "10px", padding: "12px 18px",
                    borderBottom: "1px solid rgba(3,72,82,0.05)",
                    background: n.is_read ? "transparent" : "rgba(10,190,98,0.04)",
                  }}
                >
                  <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852", lineHeight: 1.3 }}>{n.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.6)", lineHeight: 1.4 }}>{n.body}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.4)" }}>{relativeTime(n.triggered_at)}</p>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0abe62", flexShrink: 0, marginTop: "6px" }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 18px", borderTop: "1px solid rgba(3,72,82,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/dashboard/inbox" onClick={() => setOpen(false)} style={{ fontSize: "12px", color: "#209379", fontWeight: 700, textDecoration: "none" }}>
              View all →
            </Link>
            <a href="/dashboard/inbox" target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "#209379", fontWeight: 700, textDecoration: "none" }}>
              Open in new tab ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
