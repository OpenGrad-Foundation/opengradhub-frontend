"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { joinLiveClass, deleteLiveClass, type LiveClass } from "@/lib/api";
import { useLiveClasses } from "@/lib/queries/live-classes";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { ClassRoster } from "./_components/ClassRoster";
import { ClassFilterBar } from "./_components/ClassFilterBar";
import { useClassFilters } from "./_components/useClassFilters";
import { STATUS_LABEL, chipStyle, MUTED } from "@/lib/attendance-status";
import { VideoIcon, RecordedIcon, LiveDot, CalendarIcon } from "@/components/icons/ClassIcons";
import type { AttendanceStatus } from "@/lib/attendance-api";

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
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
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
      toast.success(`"${cls.title}" deleted.`);
    } catch (e) {
      // alert() blocks the page and looks nothing like the rest of the app,
      // which already has toasts.
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleJoin(cls: LiveClass) {
    setJoining(cls.id);
    // Opened BEFORE the await, while we still hold the user's gesture. Calling
    // window.open() after an awaited request puts it outside that window, so
    // Android and most blockers refuse it — and by then the join has already
    // been recorded as the attendance mark. Present, but never in the class.
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { meeting_url } = await joinLiveClass(cls.id, userId);
      if (tab && !tab.closed) tab.location.href = meeting_url;
      else setBlockedUrl(meeting_url); // blocked anyway — hand them the link
      // For an online class the click IS the attendance mark, so the list's own
      // status has to be refetched rather than left showing the old answer.
      invalidate("liveClassAttendance");
    } catch (e) {
      tab?.close();
      toast.error(e instanceof Error ? e.message : "Could not join.");
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
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Live Classes</h1>
          <p style={{ fontSize: "14px", color: MUTED, marginTop: "4px" }}>
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
          <CalendarIcon className="h-6 w-6 text-[var(--teal)]" />
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
          <p style={{ color: "#c62828", fontWeight: 600 }}>{error}</p>
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

      {/* The mark is already recorded at this point, so the only thing left to
          do is make sure the student can still actually get to the class. */}
      {blockedUrl && (
        <div style={{ ...glassCard, marginTop: "16px", padding: "16px 20px" }} role="alert">
          <p style={{ margin: 0, fontSize: "14px", color: "#034852" }}>
            Your browser blocked the meeting window. You&apos;re marked present —{" "}
            <a href={blockedUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--teal)", fontWeight: 700 }}>
              open the class
            </a>.
          </p>
        </div>
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

  /*
   * Stacks on a phone and sits in a row from `sm` up. The old card was a fixed
   * horizontal flex written in inline styles, which cannot express a media
   * query at all — so on a 375px screen the title, the meta, four buttons and
   * the join column all fought over the same line. Fellows use this on phones.
   */
  return (
    <div className={CARD + " flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6"}>
      <div className="flex items-start gap-3 sm:w-11 sm:shrink-0 sm:items-center sm:justify-center">
        {isLive ? <LiveDot /> : ended ? <RecordedIcon className="text-[#4a6b70]" /> : <VideoIcon className="text-[var(--teal)]" />}
        <p className="text-base font-bold text-[var(--dark-teal)] sm:hidden">{cls.title}</p>
      </div>

      <div className="min-w-0 flex-1">
        <p className="hidden text-[15px] font-bold text-[var(--dark-teal)] sm:block">
          {cls.title}
          {cls.is_archived_target && <ArchivedTag />}
        </p>
        {cls.is_archived_target && <span className="sm:hidden"><ArchivedTag /></span>}

        {cls.description && (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug" style={{ color: MUTED }}>
            {cls.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs" style={{ color: MUTED }}>
          <span className="inline-flex items-center gap-1.5">
            {isLive && <LiveDot className="h-2 w-2 ring-2" />}
            {isLive ? "Live now" : formatDatetime(cls.scheduled_at)}
          </span>
          <span>· {cls.duration_minutes} min</span>
          {cls.course_title && <span className="font-semibold text-[var(--teal)]">· {cls.course_title}</span>}
        </div>

        {(onEdit || onDelete || (ended && onViewAttendance)) && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {/* Past classes get exactly ONE attendance action. */}
            {ended && onViewAttendance && (
              <button onClick={(e) => { e.stopPropagation(); onViewAttendance(); }} className={LINK_BTN}>
                View attendance
              </button>
            )}
            {onEdit && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className={GHOST_BTN}>Edit</button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                disabled={deleting}
                className={DANGER_BTN + " disabled:cursor-not-allowed disabled:opacity-60"}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        )}
      </div>

      {mayJoin && !ended && (
        <div className="sm:shrink-0 sm:text-right">
          {canJoinNow ? (
            <button onClick={onJoin} disabled={joining} className={PRIMARY_BTN + " w-full sm:w-auto disabled:opacity-70"}>
              {joining ? "Joining…" : isLive ? "Join Now" : "Join (opens soon)"}
            </button>
          ) : (
            <p className="text-xs sm:text-right" style={{ color: MUTED }}>
              Opens in <strong className="text-[var(--dark-teal)]">{msToCountdown(msUntil)}</strong>
            </p>
          )}
        </div>
      )}

      {!isStaff && ended && cls.attendance_status && (
        <div className="sm:shrink-0">
          <span
            className="inline-block rounded-full px-3 py-1 text-xs font-bold"
            style={chipStyle(cls.attendance_status as AttendanceStatus)}
          >
            {STATUS_LABEL[cls.attendance_status as AttendanceStatus]}
          </span>
        </div>
      )}
    </div>
  );
}

function ArchivedTag() {
  return (
    <span className="ml-2 rounded-full bg-[rgba(3,72,82,0.07)] px-2 py-0.5 text-[11px] font-bold" style={{ color: MUTED }}>
      Archived
    </span>
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

/**
 * Tailwind equivalents of the inline styles below. The card needs breakpoints,
 * and a style object cannot express one — so everything the card touches moved
 * to classes. The rest of the page keeps its inline styles for now.
 */
const CARD = "rounded-[20px] border border-[rgba(3,72,82,0.08)] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.05)]";
const BTN_BASE = "inline-flex min-h-[44px] items-center justify-center rounded-lg px-3.5 text-[13px] font-semibold";
const LINK_BTN = `${BTN_BASE} border-[1.5px] border-[rgba(0,109,108,0.35)] text-[var(--teal)]`;
const GHOST_BTN = `${BTN_BASE} border-[1.5px] border-[rgba(3,72,82,0.2)] text-[var(--dark-teal)]`;
const DANGER_BTN = `${BTN_BASE} border-[1.5px] border-[rgba(198,40,40,0.35)] text-[#c62828]`;
const PRIMARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-5 text-[13px] font-bold text-white " +
  "bg-[linear-gradient(135deg,#067a3f_0%,#005b5a_100%)] shadow-[0_6px_14px_rgba(6,122,63,0.22)] " +
  "[font-family:var(--font-heading)]";

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "var(--teal)", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  primaryBtn: { minHeight: "44px", padding: "12px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #067a3f 0%, #005b5a 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 6px 14px rgba(6,122,63,0.22)", display: "inline-block" } as React.CSSProperties,
  segment: { minHeight: "44px", padding: "10px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-heading)", border: "1.5px solid rgba(3,72,82,0.15)", background: "transparent", color: "#034852" } as React.CSSProperties,
  segmentOn: { border: "none", background: "linear-gradient(135deg, #067a3f 0%, #005b5a 100%)", color: "#fff" } as React.CSSProperties,
  linkBtn: { minHeight: "44px", padding: "10px 14px", fontSize: "13px", fontWeight: 600, border: "1.5px solid rgba(0,109,108,0.35)", borderRadius: "8px", background: "transparent", color: "var(--teal)", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
  ghostBtn: { minHeight: "44px", padding: "10px 14px", fontSize: "13px", fontWeight: 600, border: "1.5px solid rgba(3,72,82,0.2)", borderRadius: "8px", background: "transparent", color: "#034852", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
  dangerBtn: { minHeight: "44px", padding: "10px 14px", fontSize: "13px", fontWeight: 600, border: "1.5px solid rgba(198,40,40,0.35)", borderRadius: "8px", background: "transparent", color: "#c62828", fontFamily: "var(--font-body)" } as React.CSSProperties,
};
