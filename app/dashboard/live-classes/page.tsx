"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { joinLiveClass, deleteLiveClass, type LiveClass } from "@/lib/api";
import { useLiveClasses } from "@/lib/queries/live-classes";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { LiveClassAttendeesModal } from "./_components/LiveClassAttendeesModal";

export default function LiveClassesPage() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();
  const { has }   = usePermissions();
  const userId    = data?.user?.id ?? "";
  // "Manager view" = can schedule classes; "join" is a separate permission.
  const canCreate = has(PERM.live_classes.create);
  const canJoin   = has(PERM.live_classes.join);
  const canEdit   = has(PERM.live_classes.edit);
  const canDelete = has(PERM.live_classes.delete);
  const isManager = canCreate;

  const [joining,      setJoining]      = useState<string | null>(null);
  const [deleting,     setDeleting]     = useState<string | null>(null);
  const [now,          setNow]          = useState(0);
  const [selectedClass, setSelectedClass] = useState<{ id: string; title: string } | null>(null);
  const invalidate = useInvalidate();

  const { data: classes = [], isPending: loading, error: queryError } = useLiveClasses();
  const error = queryError ? (queryError as Error).message : null;

  // Tick every minute so the "Join Now" button state refreshes
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  async function handleDelete(cls: LiveClass) {
    if (!window.confirm(`Delete "${cls.title}"? This cannot be undone.`)) return;
    setDeleting(cls.id);
    try {
      await deleteLiveClass(cls.id);
      invalidate('calendar');
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleJoin(cls: LiveClass) {
    setJoining(cls.id);
    try {
      const { meeting_url } = await joinLiveClass(cls.id, userId);
      window.open(meeting_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setJoining(null);
    }
  }

  if (isLoading) return <LoadingState />;

  const upcoming = classes.filter(c => new Date(c.scheduled_at) >= new Date(now - c.duration_minutes * 60_000));
  const past     = classes.filter(c => new Date(c.scheduled_at) < new Date(now - c.duration_minutes * 60_000));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <p style={S.label}>Live Sessions</p>
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Live Classes</h1>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/live-classes/new" style={{ ...S.primaryBtn, textDecoration: "none" }}>
            + Schedule Class
          </Link>
        )}
      </div>

      {loading ? <LoadingState /> : error ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
        </div>
      ) : classes.length === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={S.label}>No Classes Scheduled</p>
          <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>
            {isManager ? "Schedule the first live session." : "No live classes have been scheduled yet."}
          </p>
          {canCreate && (
            <Link href="/dashboard/live-classes/new" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
              + Schedule Class
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {upcoming.length > 0 && (
            <Section title="Upcoming">
              {upcoming.map(cls => (
                <ClassCard key={cls.id} cls={cls} isManager={isManager} mayJoin={canJoin} now={now}
                  onJoin={() => void handleJoin(cls)} joining={joining === cls.id}
                  onViewAttendees={isManager ? () => setSelectedClass({ id: cls.id, title: cls.title }) : undefined}
                  onEdit={canEdit ? () => router.push(`/dashboard/live-classes/${cls.id}/edit`) : undefined}
                  onDelete={canDelete ? () => void handleDelete(cls) : undefined}
                  deleting={deleting === cls.id} />
              ))}
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past Sessions">
              {past.map(cls => (
                <ClassCard key={cls.id} cls={cls} isManager={isManager} mayJoin={canJoin} now={now}
                  onJoin={() => void handleJoin(cls)} joining={joining === cls.id} past
                  onViewAttendees={isManager ? () => setSelectedClass({ id: cls.id, title: cls.title }) : undefined}
                  onEdit={canEdit ? () => router.push(`/dashboard/live-classes/${cls.id}/edit`) : undefined}
                  onDelete={canDelete ? () => void handleDelete(cls) : undefined}
                  deleting={deleting === cls.id} />
              ))}
            </Section>
          )}
        </div>
      )}

      {selectedClass && (
        <LiveClassAttendeesModal
          liveClassId={selectedClass.id}
          title={selectedClass.title}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ ...S.label, marginBottom: "12px" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{children}</div>
    </div>
  );
}

function ClassCard({ cls, isManager, mayJoin, now, onJoin, joining, past, onViewAttendees, onEdit, onDelete, deleting }: {
  cls: LiveClass; isManager: boolean; mayJoin: boolean; now: number;
  onJoin: () => void; joining: boolean; past?: boolean;
  onViewAttendees?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const scheduledMs  = new Date(cls.scheduled_at).getTime();
  const endsMs       = scheduledMs + cls.duration_minutes * 60_000;
  const msUntil      = scheduledMs - now;
  const canJoin      = !past && msUntil <= 15 * 60_000 && now < endsMs;
  const isLive       = now >= scheduledMs && now < endsMs;

  function formatDatetime(iso: string) {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function msToCountdown(ms: number) {
    const totalMin = Math.ceil(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "20px", padding: "20px 24px" }}>
      {/* Live indicator */}
      <div style={{ flexShrink: 0, width: "44px", textAlign: "center" }}>
        {isLive ? (
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#e53e3e", boxShadow: "0 0 0 4px rgba(229,62,62,0.2)" }} />
        ) : past ? (
          <span style={{ fontSize: "20px" }}>📹</span>
        ) : (
          <span style={{ fontSize: "20px" }}>🎥</span>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#034852" }}>{cls.title}</p>
        {cls.description && (
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: "rgba(3,72,82,0.6)", lineHeight: 1.4 }}>
            {cls.description.slice(0, 80)}{cls.description.length > 80 ? "…" : ""}
          </p>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
            {isLive ? "🔴 Live now" : formatDatetime(cls.scheduled_at)}
          </span>
          <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>· {cls.duration_minutes} min</span>
          {cls.course_title && <span style={{ fontSize: "12px", color: "#209379", fontWeight: 600 }}>· {cls.course_title}</span>}
          {cls.programme_type && <span style={{ fontSize: "12px", color: "#209379", fontWeight: 600 }}>· {cls.programme_type}</span>}
          {isManager && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewAttendees?.(); }}
              style={{ background: "none", border: "none", padding: 0, cursor: onViewAttendees ? "pointer" : "default", fontSize: "12px", color: onViewAttendees ? "#209379" : "rgba(3,72,82,0.45)", fontWeight: onViewAttendees ? 600 : 400, textDecoration: onViewAttendees ? "underline" : "none" }}
            >
              · {cls.attendee_count} attendees
            </button>
          )}
        </div>
        {isManager && (onEdit || onDelete) && (
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                style={{ padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", cursor: "pointer", fontFamily: "var(--font-body)" }}
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={deleting}
                style={{ padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "1.5px solid rgba(229,62,62,0.3)", borderRadius: "8px", background: "transparent", color: "#e53e3e", cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, fontFamily: "var(--font-body)" }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Join / countdown */}
      {mayJoin && !past && (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          {canJoin ? (
            <button
              onClick={onJoin}
              disabled={joining}
              style={{ ...S.primaryBtn, opacity: joining ? 0.7 : 1, fontSize: "13px" }}
            >
              {joining ? "Joining…" : isLive ? "Join Now" : "Join (opens soon)"}
            </button>
          ) : (
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)", margin: 0, textAlign: "right" }}>
              Opens in<br />
              <strong style={{ color: "#034852" }}>{msToCountdown(msUntil)}</strong>
            </p>
          )}
        </div>
      )}

      {/* Joined / Missed badge for students on past classes */}
      {!isManager && past && (
        <div style={{ flexShrink: 0 }}>
          <span style={{
            display: "inline-block",
            padding: "4px 12px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 700,
            ...(cls.attended
              ? { background: "rgba(10,190,98,0.12)", color: "#0abe62" }
              : { background: "rgba(3,72,82,0.07)", color: "rgba(3,72,82,0.4)" }),
          }}>
            {cls.attended ? "Joined" : "Missed"}
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Fetching live classes…</p>
      </div>
    </div>
  );
}

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const S = {
  label:      { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading:    { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  primaryBtn: { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", display: "inline-block" } as React.CSSProperties,
};
