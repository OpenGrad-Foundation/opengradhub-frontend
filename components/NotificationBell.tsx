"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  markAllNotificationsRead,
  markAllAnnouncementsRead,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useInboxFeed, useInboxUnreadCount, type InboxItem } from "@/lib/queries/inbox";
import { useMarkAnnouncementRead } from "@/lib/queries/announcements";
import { useMarkNotificationRead } from "@/lib/queries/notifications";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { NOTIFICATION_ROUTES } from "@/lib/notification-routes";

// ── Type icon map ──────────────────────────────────────────────

function itemIcon(item: InboxItem): string {
  if (item.source === "announcement") return "📢";
  const type = item.type;
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

export default function NotificationBell() {
  const { data: unreadData } = useInboxUnreadCount();
  const count = unreadData?.count ?? 0;
  const invalidate = useInvalidate();
  const router = useRouter();

  // Unified feed: announcements + notifications, same source as the badge count
  // and the /dashboard/inbox page. Counting one set but listing another is what
  // produced "ghost" badges — a non-zero count with nothing unread to click.
  const { data: currentUser } = useCurrentUser();
  const roleCode = currentUser?.role?.code ?? "";
  const { items, isLoading } = useInboxFeed({ role: roleCode });
  const markAnnRead   = useMarkAnnouncementRead();
  const markNotifRead = useMarkNotificationRead();

  const [open, setOpen] = useState(false);
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

  function handleOpen() {
    setOpen(prev => !prev);
  }

  async function handleMarkAll() {
    // Badge = notification unread + announcement unread, so clearing it means
    // marking BOTH read. Invalidate both domains so the list + badge refetch
    // immediately instead of waiting for the poll cycle.
    try {
      await Promise.all([
        markAllNotificationsRead(),
        markAllAnnouncementsRead(),
      ]);
      invalidate("notifications", "announcements");
    } catch { /* ignore — next poll reconciles */ }
  }

  function handleItemClick(item: InboxItem) {
    // Mark as read via the right domain — announcements clear through
    // announcement_reads, notifications through notifications.is_read.
    if (!item.is_read) {
      if (item.source === "announcement") markAnnRead.mutate(item.id);
      else markNotifRead.mutate({ id: item.id, read: true });
    }
    // Only notifications have deep-link routes.
    if (item.source === "notification") {
      const route = NOTIFICATION_ROUTES[item.type];
      if (route) {
        setOpen(false);
        router.push(route);
      }
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        className="relative flex items-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer select-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} aria-hidden="true" />
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
            {isLoading ? (
              <p style={{ textAlign: "center", padding: "20px", fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>Loading…</p>
            ) : items.length === 0 ? (
              <p style={{ textAlign: "center", padding: "24px", fontSize: "13px", color: "rgba(3,72,82,0.4)" }}>No notifications yet</p>
            ) : (
              items.map(item => {
                const route = item.source === "notification"
                  ? NOTIFICATION_ROUTES[item.type]
                  : undefined;
                const isClickable = !item.is_read || !!route;
                const Tag = route ? "button" : "div";
                return (
                  <Tag
                    key={`${item.source}:${item.id}`}
                    {...(route ? { type: "button" as const } : {})}
                    onClick={() => handleItemClick(item)}
                    style={{
                      display: "flex", gap: "10px", padding: "12px 18px",
                      borderBottom: "1px solid rgba(3,72,82,0.05)",
                      background: item.is_read ? "transparent" : "rgba(10,190,98,0.04)",
                      cursor: isClickable ? "pointer" : "default",
                      // reset button defaults when rendered as button
                      ...(route ? {
                        width: "100%", textAlign: "left" as const,
                        border: "none", outline: "none",
                        font: "inherit",
                      } : {}),
                    }}
                  >
                    <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{itemIcon(item)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852", lineHeight: 1.3 }}>{item.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.6)", lineHeight: 1.4 }}>{item.body}</p>
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.4)" }}>{relativeTime(item.created_at)}</p>
                    </div>
                    {!item.is_read && (
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0abe62", flexShrink: 0, marginTop: "6px" }} />
                    )}
                  </Tag>
                );
              })
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
