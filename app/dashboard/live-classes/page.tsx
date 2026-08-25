"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { joinLiveClass, deleteLiveClass, type LiveClass } from "@/lib/api";
import { useLiveClasses } from "@/lib/queries/live-classes";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { ClassRoster } from "./_components/ClassRoster";
import { ClassFilterBar } from "./_components/ClassFilterBar";
import { useClassFilters } from "./_components/useClassFilters";

/**
 * One class list.
 *
 * The old `Classes | Students` switch is gone: cross-class student reporting
 * belongs in Attendance, which now answers it for online AND school-based
 * cohorts from one place. What stays here is the list, and one attendance
 * action per past class that opens the canonical roster.
 */
export default function LiveClassesPage() {
  return (
    // useSearchParams opts a static route into client rendering, which Next
    // requires a boundary for. Fallback is the chrome only — no query fires
    // twice through hydration.
    <Suspense fallback={<LoadingState />}>
      <LiveClassesInner />
    </Suspense>
  );
}

function LiveClassesInner() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();
  const { has } = usePermissions();
  const userId = data?.user?.id ?? "";

  const canCreate = has(PERM.live_classes.create);
  const canJoin = has(PERM.live_classes.join);
  const canEdit = has(PERM.live_classes.edit);
  const canDelete = has(PERM.live_classes.delete);
  const canAttendance = has(PERM.live_classes.attendance);
  const isStaff = canCreate || canAttendance;

  const { state, set, apiFilters } = useClassFilters();
  // Students get one switch; the audience picker and archived toggle are staff
  // tools and would leak the shape of cohorts they are not part of.
  const { data: classes = [], isPending: loading, error: queryError, refetch } =
    useLiveClasses(isStaff ? apiFilters : { view: state.view });
  const error = queryError ? (queryError as Error).message : null;

  const [joining, setJoining] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rosterClass, setRosterClass] = useState<string | null>(null);
  const invalidate = useInvalidate();

  // Tick every minute so the "Join Now" button state refreshes.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Upcoming/Past is decided by the SERVER, so a class crossing its end time
  // makes an already-open list wrong — it lingers under Upcoming, or never
  // appears under Past. Refetch exactly when one crosses, not every tick.
  const endedCount = classes.filter(
    (c) => now >= new Date(c.scheduled_at).getTime() + c.duration_minutes * 60_000,
  ).length;
  const lastEndedCount = useRef(endedCount);
  useEffect(() => {
    if (lastEndedCount.current !== endedCount) {
      lastEndedCount.current = endedCount;
      void refetch();
    }
  }, [endedCount, refetch]);

  async function handleDelete(cls: LiveClass) {
    if (!window.confirm(`Delete "${cls.title}"? This cannot be undone.`)) return;
    setDeleting(cls.id);
    try {
      await deleteLiveClass(cls.id);
      invalidate("calendar");
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
      // For an online class the click IS the attendance mark, so the list's own
      // status has to be refetched rather than left showing the old answer.
      invalidate("liveClassAttendance");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not join.");
    } finally {
      setJoining(null);
    }
  }

  if (isLoading) return <LoadingState />;

  const isPast = state.view === "past";
  // Only classes with a recorded answer count. Including "Not recorded" ones
  // would contradict the badge the very same card shows.
  const attended = classes.filter((c) => c.attendance_status === "PRESENT").length;
  const recorded = classes.filter(
    (c) => c.attendance_status === "PRESENT" || c.attendance_status === "ABSENT",
  ).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <p style={S.label}>Live Sessions</p>
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Live Classes</h1>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
            {classes.length} {isPast ? "past" : "upcoming"}
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/live-classes/new" style={{ ...S.primaryBtn, textDecoration: "none" }}>
            + Schedule Class
          </Link>
        )}
      </div>

      {isStaff ? (
        <ClassFilterBar state={state} set={set} />
      ) : (
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px" }} role="group" aria-label="Time filter">
          {(["upcoming", "past"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set({ view: v })}
              aria-pressed={state.view === v}
              style={{ ...S.segment, ...(state.view === v ? S.segmentOn : {}) }}
            >
              {v === "upcoming" ? "Upcoming" : "Past"}
            </button>
          ))}
        </div>
      )}

      {!isStaff && isPast && recorded > 0 && (
        <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "16px", padding: "16px 24px", marginBottom: "20px" }}>
          <span style={{ fontSize: "22px" }}>🗓️</span>
          <div>
            <p style={{ ...S.label, marginBottom: "2px" }}>My Attendance</p>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#034852" }}>
              {attended}/{recorded} classes attended
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
        </div>
      ) : classes.length === 0 ? (
        <EmptyState isPast={isPast} canCreate={canCreate} isStaff={isStaff} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              isStaff={isStaff}
              mayJoin={canJoin}
              now={now}
              onJoin={() => void handleJoin(cls)}
              joining={joining === cls.id}
              onViewAttendance={canAttendance ? () => setRosterClass(cls.id) : undefined}
              onEdit={canEdit ? () => router.push(`/dashboard/live-classes/${cls.id}/edit`) : undefined}
              onDelete={canDelete ? () => void handleDelete(cls) : undefined}
              deleting={deleting === cls.id}
            />
          ))}
        </div>
      )}

      {rosterClass && (
        <ClassRoster liveClassId={rosterClass} onClose={() => setRosterClass(null)} />
      )}
    </div>
  );
}

function EmptyState({ isPast, canCreate, isStaff }: { isPast: boolean; canCreate: boolean; isStaff: boolean }) {
  return (
    <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
      <p style={S.label}>{isPast ? "Nothing here" : "No Classes Scheduled"}</p>
      <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>
        {isPast
          ? "No past classes match these filters."
          : isStaff
            ? "Schedule the first live session."
            : "No live classes have been scheduled for you yet."}
      </p>
      {canCreate && !isPast && (
        <Link href="/dashboard/live-classes/new" style={{ ...S.primaryBtn, display: "inline-block", marginTop: "16px", textDecoration: "none" }}>
          + Schedule Class
        </Link>
      )}
    </div>
  );
}

const STATUS_CHIP: Record<string, React.CSSProperties> = {
  PRESENT: { background: "rgba(10,190,98,0.12)", color: "#0abe62" },
  ABSENT: { background: "rgba(229,62,62,0.1)", color: "#e53e3e" },
  UNKNOWN: { background: "rgba(3,72,82,0.07)", color: "rgba(3,72,82,0.5)" },
};
const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  UNKNOWN: "Not recorded",
};

function ClassCard({
  cls, isStaff, mayJoin, now, onJoin, joining, onViewAttendance, onEdit, onDelete, deleting,
}: {
  cls: LiveClass;
  isStaff: boolean;
  mayJoin: boolean;
  now: number;
  onJoin: () => void;
  joining: boolean;
  onViewAttendance?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const scheduledMs = new Date(cls.scheduled_at).getTime();
  const endsMs = scheduledMs + cls.duration_minutes * 60_000;
  const msUntil = scheduledMs - now;
  const ended = now >= endsMs;
  const isLive = now >= scheduledMs && !ended;
  const canJoinNow = !ended && msUntil <= 15 * 60_000;

  function formatDatetime(iso: string) {
    const d = new Date(iso);
    // Explicit locale prevents a hydration mismatch: the server runs UTC while
    // the browser uses the user's own locale.
    return `${d.toLocaleDateString("en-IN")} at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function msToCountdown(ms: number) {
    const totalMin = Math.ceil(ms / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "20px", padding: "20px 24px" }}>
      <div style={{ flexShrink: 0, width: "44px", textAlign: "center" }}>
        {isLive ? (
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#e53e3e", boxShadow: "0 0 0 4px rgba(229,62,62,0.2)" }} />
        ) : (
          <span style={{ fontSize: "20px" }}>{ended ? "📹" : "🎥"}</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#034852" }}>
          {cls.title}
          {cls.is_archived_target && (
            <span style={{ marginLeft: "8px", padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: "rgba(3,72,82,0.07)", color: "rgba(3,72,82,0.55)" }}>
              Archived
            </span>
          )}
        </p>
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
        </div>

        {(onEdit || onDelete || (ended && onViewAttendance)) && (
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            {/* Past classes get exactly ONE attendance action. */}
            {ended && onViewAttendance && (
              <button onClick={(e) => { e.stopPropagation(); onViewAttendance(); }} style={S.linkBtn}>
                View attendance
              </button>
            )}
            {onEdit && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={S.ghostBtn}>Edit</button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={deleting}
                style={{ ...S.dangerBtn, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        )}
      </div>

      {mayJoin && !ended && (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          {canJoinNow ? (
            <button onClick={onJoin} disabled={joining} style={{ ...S.primaryBtn, opacity: joining ? 0.7 : 1, fontSize: "13px" }}>
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

      {!isStaff && ended && cls.attendance_status && (
        <div style={{ flexShrink: 0 }}>
          <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700, ...STATUS_CHIP[cls.attendance_status] }}>
            {STATUS_LABEL[cls.attendance_status]}
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
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  primaryBtn: { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(10,190,98,0.2)", display: "inline-block" } as React.CSSProperties,
  segment: { padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-heading)", border: "1.5px solid rgba(3,72,82,0.15)", background: "transparent", color: "#034852" } as React.CSSProperties,
  segmentOn: { border: "none", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff" } as React.CSSProperties,
  linkBtn: { padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "1.5px solid rgba(32,147,121,0.35)", borderRadius: "8px", background: "transparent", color: "#209379", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
  ghostBtn: { padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
  dangerBtn: { padding: "4px 12px", fontSize: "12px", fontWeight: 600, border: "1.5px solid rgba(229,62,62,0.3)", borderRadius: "8px", background: "transparent", color: "#e53e3e", fontFamily: "var(--font-body)" } as React.CSSProperties,
};
