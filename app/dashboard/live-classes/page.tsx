"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { joinLiveClass, deleteLiveClass, type LiveClass } from "@/lib/api";
import { openMeetingTab } from "@/lib/meeting-tab";
import { useLiveClasses } from "@/lib/queries/live-classes";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { ClassRoster } from "./_components/ClassRoster";
import { ClassFilterBar } from "./_components/ClassFilterBar";
import { useClassFilters } from "./_components/useClassFilters";
import { STATUS_LABEL, chipStyle, MUTED } from "@/lib/attendance-status";
import { VideoIcon, RecordedIcon, LiveDot, CalendarIcon } from "@/components/icons/ClassIcons";
import { Plus } from "lucide-react";
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
  // The API returns the full filtered list. Sort a copy so other cache consumers
  // keep their own ordering (e.g. school confirmations and the class editor).
  const sortedClasses = useMemo(() => [...classes].sort((a, b) => {
    const difference = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    return (state.sort === "newest" ? -difference : difference) || a.id.localeCompare(b.id);
  }), [classes, state.sort]);

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
    let url = "";
    try {
      const opened = await openMeetingTab(async () => {
        url = (await joinLiveClass(cls.id, userId)).meeting_url;
        return url;
      });
      if (!opened) setBlockedUrl(url); // blocked anyway — hand them the link
      // For an online class the click IS the attendance mark, so the list's own
      // status has to be refetched rather than left showing the old answer.
      invalidate("liveClassAttendance");
    } catch (e) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "20px" }}>
        <p role="status" style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
          {classes.length} {isPast ? "past" : "upcoming"} class{classes.length !== 1 ? "es" : ""}
        </p>
        {canCreate && (
          <Link href="/dashboard/live-classes/new" style={S.primaryBtn}>
            <Plus size={18} aria-hidden="true" />Schedule class
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
            <p style={{ ...S.label, marginBottom: "2px" }}>My attendance</p>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--color-text)" }}>
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
          {sortedClasses.map((cls) => (
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
          <p style={{ margin: 0, fontSize: "14px", color: "var(--color-text)" }}>
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
    <div style={{ ...glassCard, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center", padding: "48px 24px" }}>
      <CalendarIcon className="h-6 w-6 text-[var(--teal)]" />
      <h2 style={{ ...S.heading, fontSize: "18px", margin: 0 }}>{isPast ? "Nothing here" : "No classes scheduled"}</h2>
      <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: 0 }}>
        {isPast
          ? "No past classes match these filters."
          : isStaff
            ? "Schedule the first live session."
            : "No live classes have been scheduled for you yet."}
      </p>
      {canCreate && !isPast && (
        <Link href="/dashboard/live-classes/new" style={{ ...S.primaryBtn, marginTop: "4px" }}>
          <Plus size={18} aria-hidden="true" />Schedule class
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
const CARD = "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]";
const BTN_BASE = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[13px] font-semibold";
const LINK_BTN = `${BTN_BASE} text-[var(--teal)]`;
const GHOST_BTN = `${BTN_BASE} text-[var(--color-text)]`;
const DANGER_BTN = `${BTN_BASE} text-[#b83232]`;
const PRIMARY_BTN =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--green)] bg-[var(--green)] px-4 text-sm font-semibold text-[var(--dark-teal)]";

const glassCard: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px, 4vw, 24px)" };
const S = {
  label: { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 } as React.CSSProperties,
  heading: { fontWeight: 600, color: "var(--color-text)" } as React.CSSProperties,
  primaryBtn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", border: "1px solid var(--green)", borderRadius: "12px", background: "var(--green)", color: "var(--dark-teal)", fontWeight: 600, fontSize: "14px", cursor: "pointer", textDecoration: "none" } as React.CSSProperties,
  segment: { minHeight: "44px", padding: "8px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)" } as React.CSSProperties,
  segmentOn: { borderColor: "var(--color-border-strong)", background: "var(--color-success-surface)", color: "var(--dark-teal)" } as React.CSSProperties,
  linkBtn: { minHeight: "44px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", cursor: "pointer", color: "var(--teal)" } as React.CSSProperties,
  ghostBtn: { minHeight: "44px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", cursor: "pointer", color: "var(--color-text)" } as React.CSSProperties,
  dangerBtn: { minHeight: "44px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: "12px", background: "var(--color-surface)", cursor: "pointer", color: "#b83232" } as React.CSSProperties,
};
