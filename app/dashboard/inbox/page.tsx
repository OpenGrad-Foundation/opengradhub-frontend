"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInboxFeed, type InboxItem } from "@/lib/queries/inbox";
import { useMarkAnnouncementRead } from "@/lib/queries/announcements";
import {
  useArchiveNotification,
  useClearRead,
  useMarkNotificationRead,
} from "@/lib/queries/notifications";
import { markAllAnnouncementsRead, markAllNotificationsRead } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { ComposeMessageModal } from "@/components/ComposeMessageModal";

type Filter = "all" | "unread" | "notifications" | "announcements";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",           label: "All" },
  { value: "unread",        label: "Unread" },
  { value: "notifications", label: "Notifications" },
  { value: "announcements", label: "Announcements" },
];

export default function InboxPage() {
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode    = data?.role?.code  ?? "";

  const [filter,       setFilter]       = useState<Filter>("all");
  const [composeOpen,  setComposeOpen]  = useState(false);

  const canCompose = usePermission(PERM.notifications.send);
  const canCreateAnn = usePermission(PERM.announcements.create);
  const showCompose = canCompose || canCreateAnn;

  const { items, isLoading } = useInboxFeed({ role: roleCode });
  const markAnnRead   = useMarkAnnouncementRead();
  const markNotifRead = useMarkNotificationRead();
  const archiveNotif  = useArchiveNotification();
  const clearRead     = useClearRead();
  const invalidate    = useInvalidate();

  const hasUnread = items.some((i) => !i.is_read);
  const hasReadNotifications = items.some(
    (i) => i.source === "notification" && i.is_read,
  );

  async function handleMarkAllRead() {
    await Promise.all([markAllNotificationsRead(), markAllAnnouncementsRead()]);
    invalidate("notifications", "announcements");
  }

  function handleRowClick(item: InboxItem) {
    if (item.is_read) return;
    if (item.source === "announcement") markAnnRead.mutate(item.id);
    else markNotifRead.mutate({ id: item.id, read: true });
  }

  const filtered = items.filter((i) => {
    if (filter === "all")           return true;
    if (filter === "unread")        return !i.is_read;
    if (filter === "notifications") return i.source === "notification";
    return i.source === "announcement";
  });

  if (userLoading) return <LoadingState message="Loading your inbox…" />;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <p style={S.label}>Messages</p>
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Inbox</h1>
          <p style={{ ...S.subtitle, marginTop: "4px" }}>Your notifications and announcements</p>
          <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
            {hasUnread && (
              <button style={S.textButton} onClick={() => void handleMarkAllRead()}>
                ✓ Mark all read
              </button>
            )}
            {hasReadNotifications && (
              <button
                style={S.textButton}
                onClick={() => clearRead.mutate()}
                title="Dismiss all read notifications"
              >
                ✕ Clear read
              </button>
            )}
          </div>
        </div>
        {showCompose && (
          <button
            style={S.primaryButton}
            onClick={() => setComposeOpen(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform  = "translateY(-2px)";
              e.currentTarget.style.boxShadow  = "0 12px 20px rgba(10,190,98,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform  = "translateY(0)";
              e.currentTarget.style.boxShadow  = "0 8px 16px rgba(10,190,98,0.2)";
            }}
          >
            + Compose
          </button>
        )}
      </div>

      {/* ── Filter Chips ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                padding: "8px 18px",
                border: "1px solid",
                borderRadius: "100px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
                borderColor: active ? "rgba(10,190,98,0.3)" : "rgba(3,72,82,0.15)",
                background:  active ? "rgba(10,190,98,0.12)" : "rgba(255,255,255,0.7)",
                color:       active ? "#0a944e" : "#034852",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Feed ───────────────────────────────────────────────── */}
      {isLoading ? (
        <LoadingState message="Fetching messages…" />
      ) : filtered.length === 0 ? (
        <div style={{ ...S.glassCard, textAlign: "center", padding: "48px 32px" }}>
          <p style={{ fontSize: "32px", marginBottom: "8px" }}>📬</p>
          <p style={{ ...S.heading, fontSize: "18px", margin: 0 }}>
            {filter === "all" ? "All caught up" : `No ${filter}`}
          </p>
          <p style={{ ...S.subtitle, marginTop: "8px" }}>
            {filter === "all"
              ? "You have no messages yet."
              : `No ${filter} to show.`}
          </p>
        </div>
      ) : (
        <div style={{ ...S.glassCard, padding: 0, overflow: "hidden" }}>
          {filtered.map((item, idx) => {
            const isAnn   = item.source === "announcement";
            const isUnread = !item.is_read;
            const dateStr  = new Date(item.created_at).toLocaleDateString([], {
              month: "short", day: "numeric",
            });
            const timeStr  = new Date(item.created_at).toLocaleTimeString([], {
              hour: "2-digit", minute: "2-digit",
            });

            return (
              <div
                key={`${item.source}:${item.id}`}
                onClick={() => handleRowClick(item)}
                style={{
                  display: "flex",
                  gap: "14px",
                  padding: "16px 24px",
                  borderBottom: idx < filtered.length - 1 ? "1px solid rgba(3,72,82,0.06)" : "none",
                  background: isUnread ? "rgba(10,190,98,0.03)" : "transparent",
                  cursor: isUnread ? "pointer" : "default",
                  transition: "background 150ms",
                  position: "relative",
                }}
              >
                {/* Unread accent */}
                {isUnread && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0, top: 0, bottom: 0,
                      width: "3px",
                      background: "var(--green, #0abe62)",
                      borderRadius: "0 2px 2px 0",
                    }}
                  />
                )}

                {/* Source badge */}
                <span
                  style={{
                    alignSelf: "flex-start",
                    marginTop: "2px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                    background: isAnn
                      ? "rgba(32,147,121,0.12)"
                      : "rgba(3,72,82,0.08)",
                    color: isAnn ? "#0a944e" : "#034852",
                    border: isAnn
                      ? "1px solid rgba(10,190,98,0.2)"
                      : "1px solid rgba(3,72,82,0.12)",
                  }}
                >
                  {isAnn ? "Announcement" : "Notification"}
                </span>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: isUnread ? 700 : 600,
                        color: "#034852",
                        lineHeight: 1.3,
                      }}
                    >
                      {item.title}
                    </p>
                    <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.4)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {dateStr} {timeStr}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "13px",
                      color: "rgba(3,72,82,0.65)",
                      lineHeight: 1.5,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {item.body}
                  </p>
                  {isUnread && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px", height: "6px",
                        borderRadius: "50%",
                        background: "#0abe62",
                        marginTop: "6px",
                      }}
                    />
                  )}
                </div>

                {!isAnn && (
                  <div
                    style={{ display: "flex", gap: "4px", alignSelf: "flex-start", flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      title={item.is_read ? "Mark as unread" : "Mark as read"}
                      aria-label={item.is_read ? "Mark as unread" : "Mark as read"}
                      onClick={() =>
                        markNotifRead.mutate({ id: item.id, read: !item.is_read })
                      }
                      style={S.iconButton}
                    >
                      {item.is_read ? "↩" : "✓"}
                    </button>
                    <button
                      title="Dismiss"
                      aria-label="Dismiss notification"
                      onClick={() => archiveNotif.mutate(item.id)}
                      style={S.iconButton}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compose Modal ──────────────────────────────────────── */}
      {composeOpen && (
        <ComposeMessageModal onClose={() => setComposeOpen(false)} />
      )}
    </div>
  );
}

// ── Loading skeleton ────────────────────────────────────────────

function LoadingState({ message }: { message: string }) {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ marginTop: "12px", fontSize: "22px", fontWeight: 700, color: "#034852" }}>
          {message}
        </p>
      </div>
    </div>
  );
}

// ── Shared styles ───────────────────────────────────────────────

const S = {
  label: {
    fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.28em", color: "#209379", margin: 0,
  } as React.CSSProperties,

  heading: {
    fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "14px", color: "rgba(3,72,82,0.6)",
  } as React.CSSProperties,

  glassCard: {
    background: "#ffffff",
    border: "1px solid rgba(3,72,82,0.08)",
    borderRadius: "24px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
  } as React.CSSProperties,

  primaryButton: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
    color: "#ffffff",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    boxShadow: "0 8px 16px rgba(10,190,98,0.2)",
    transition: "all 280ms cubic-bezier(0.16,1,0.3,1)",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  textButton: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: "12px",
    fontWeight: 700,
    color: "#209379",
    cursor: "pointer",
  } as React.CSSProperties,

  iconButton: {
    width: "26px",
    height: "26px",
    border: "1px solid rgba(3,72,82,0.12)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.8)",
    color: "#034852",
    fontSize: "12px",
    lineHeight: 1,
    cursor: "pointer",
  } as React.CSSProperties,
};
