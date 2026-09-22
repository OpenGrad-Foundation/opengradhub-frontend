"use client";

import { useState } from "react";
import { Check, Inbox, Plus, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermission } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { useInboxFeed, type InboxItem } from "@/lib/queries/inbox";
import { useMarkAnnouncementRead } from "@/lib/queries/announcements";
import {
  useArchiveNotification,
  useClearAll,
  useClearRead,
  useMarkNotificationRead,
} from "@/lib/queries/notifications";
import { markAllAnnouncementsRead, markAllNotificationsRead } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { notificationRoute } from "@/lib/notification-routes";
import { ComposeMessageModal } from "@/components/ComposeMessageModal";

type Filter = "all" | "unread" | "notifications" | "announcements";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all",           label: "All" },
  { value: "unread",        label: "Unread" },
  { value: "notifications", label: "Notifications" },
  { value: "announcements", label: "Announcements" },
];

// Rendering the whole feed at once froze the page for users with a large
// backlog — rows mount in pages instead.
const PAGE_SIZE = 50;

export default function InboxPage() {
  const router = useRouter();
  const { data, isLoading: userLoading } = useCurrentUser();
  const roleCode    = data?.role?.code  ?? "";

  const [filter,       setFilter]       = useState<Filter>("all");
  const [composeOpen,  setComposeOpen]  = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const canCompose = usePermission(PERM.notifications.send);
  const canCreateAnn = usePermission(PERM.announcements.create);
  const showCompose = canCompose || canCreateAnn;

  const { items, isLoading } = useInboxFeed({ role: roleCode });
  const markAnnRead   = useMarkAnnouncementRead();
  const markNotifRead = useMarkNotificationRead();
  const archiveNotif  = useArchiveNotification();
  const clearRead     = useClearRead();
  const clearAll      = useClearAll();
  const invalidate    = useInvalidate();

  const hasUnread = items.some((i) => !i.is_read);
  const hasReadNotifications = items.some(
    (i) => i.source === "notification" && i.is_read,
  );
  // Shown for announcements too: "Clear all" marks them read, which is the only
  // dismiss a role-scoped broadcast has.
  const hasAnything = items.length > 0;

  /**
   * Empty the inbox in one click — the escape hatch for a feed that filled
   * faster than it could be read. Announcements have no per-user archive, so
   * the strongest dismiss available for them is a read receipt.
   */
  async function handleClearAll() {
    await Promise.all([clearAll.mutateAsync(), markAllAnnouncementsRead()]);
    invalidate("notifications", "announcements");
  }

  async function handleMarkAllRead() {
    await Promise.all([markAllNotificationsRead(), markAllAnnouncementsRead()]);
    invalidate("notifications", "announcements");
  }

  function handleRowClick(item: InboxItem) {
    if (!item.is_read) {
      if (item.source === "announcement") markAnnRead.mutate(item.id);
      else markNotifRead.mutate({ id: item.id, read: true });
    }
    if (item.source === "notification") {
      const route = notificationRoute(item.type, item.link);
      if (route) router.push(route);
    }
  }

  const filtered = items.filter((i) => {
    if (filter === "all")           return true;
    if (filter === "unread")        return !i.is_read;
    if (filter === "notifications") return i.source === "notification";
    return i.source === "announcement";
  });
  const visible = filtered.slice(0, visibleCount);

  if (userLoading) return <LoadingState message="Loading your inbox…" />;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div style={{ display: "flex", gap: "12px" }}>
            {hasUnread && (
              <button style={S.textButton} onClick={() => void handleMarkAllRead()}>
                <Check size={16} aria-hidden="true" />Mark all read
              </button>
            )}
            {hasReadNotifications && (
              <button
                style={S.textButton}
                onClick={() => clearRead.mutate()}
                title="Dismiss all read notifications"
              >
                <X size={16} aria-hidden="true" />Clear read
              </button>
            )}
            {hasAnything && (
              <button
                style={{ ...S.textButton, color: "#b83232" }}
                onClick={() => void handleClearAll()}
                disabled={clearAll.isPending}
                title="Dismiss every notification, read or unread"
              >
                {clearAll.isPending ? "Clearing…" : <><X size={16} aria-hidden="true" />Clear all</>}
              </button>
            )}
          </div>
        {showCompose && (
          <button
            style={S.primaryButton}
            onClick={() => setComposeOpen(true)}
          >
            <Plus size={18} aria-hidden="true" />Compose
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
              onClick={() => {
                setFilter(value);
                setVisibleCount(PAGE_SIZE);
              }}
              style={{
                minHeight: "44px",
                padding: "8px 16px",
                border: "1px solid",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 150ms ease",
                borderColor: active ? "var(--color-border-strong)" : "var(--color-border)",
                background:  active ? "var(--color-success-surface)" : "var(--color-surface)",
                color:       active ? "var(--dark-teal)" : "var(--color-text)",
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
          <Inbox size={32} aria-hidden="true" style={{ color: "var(--color-text-muted)", marginBottom: "8px" }} />
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
          {visible.map((item, idx) => {
            const isAnn   = item.source === "announcement";
            const isUnread = !item.is_read;
            const hasRoute = item.source === "notification" && !!notificationRoute(item.type, item.link);
            const isClickable = isUnread || hasRoute;
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
                  borderBottom: idx < visible.length - 1 ? "1px solid var(--color-border)" : "none",
                  background: isUnread ? "rgba(10,190,98,0.03)" : "transparent",
                  cursor: isClickable ? "pointer" : "default",
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
                    fontSize: "12px",
                    fontWeight: 600,
                    flexShrink: 0,
                    background: isAnn
                      ? "rgba(32,147,121,0.12)"
                      : "rgba(3,72,82,0.08)",
                    color: isAnn ? "#08784a" : "var(--color-text)",
                    border: isAnn
                      ? "1px solid rgba(10,190,98,0.2)"
                      : "1px solid var(--color-border)",
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
                        color: "var(--color-text)",
                        lineHeight: 1.3,
                      }}
                    >
                      {item.title}
                    </p>
                    <span style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
                      {dateStr} {timeStr}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "13px",
                      color: "var(--color-text-muted)",
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
                      {item.is_read ? <Undo2 size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
                    </button>
                    <button
                      title="Dismiss"
                      aria-label="Dismiss notification"
                      onClick={() => archiveNotif.mutate(item.id)}
                      style={S.iconButton}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > visibleCount && (
            <div style={{ padding: "14px", textAlign: "center", borderTop: "1px solid var(--color-border)" }}>
              <button
                style={S.textButton}
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
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
        <p style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--color-text)" }}>
          {message}
        </p>
      </div>
    </div>
  );
}

// ── Shared styles ───────────────────────────────────────────────

const S = {
  heading: {
    fontWeight: 700, color: "var(--color-text)",
  } as React.CSSProperties,

  subtitle: {
    fontSize: "14px", color: "var(--color-text-muted)",
  } as React.CSSProperties,

  glassCard: {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "12px",
    padding: "clamp(16px,4vw,24px)",
  } as React.CSSProperties,

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    padding: "8px 16px",
    border: "1px solid var(--green)",
    borderRadius: "12px",
    background: "var(--green)",
    color: "var(--dark-teal)",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  textButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minHeight: "44px",
    background: "none",
    border: "none",
    padding: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "#08784a",
    cursor: "pointer",
  } as React.CSSProperties,

  iconButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    background: "var(--color-surface)",
    color: "var(--color-text)",
    fontSize: "12px",
    lineHeight: 1,
    cursor: "pointer",
  } as React.CSSProperties,
};
