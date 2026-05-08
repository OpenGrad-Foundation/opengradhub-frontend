"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getLiveClasses, getAssignments, type LiveClass, type Assignment } from "@/lib/api";

type CalendarEvent =
  | { kind: "live"; data: LiveClass; date: Date }
  | { kind: "assignment"; data: Assignment; date: Date };

export default function CalendarPage() {
  const { data: userData, isLoading } = useCurrentUser();
  const roleCode = userData?.role?.code ?? "";
  const userId   = userData?.user?.id ?? "";

  const [events,  setEvents]  = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !userId) return;
    setLoading(true);
    Promise.all([
      getLiveClasses(userId, roleCode).catch(() => [] as LiveClass[]),
      getAssignments(userId, roleCode).catch(() => [] as Assignment[]),
    ]).then(([classes, assignments]) => {
      const all: CalendarEvent[] = [
        ...classes.map(c => ({ kind: "live" as const,       data: c, date: new Date(c.scheduled_at) })),
        ...assignments.map(a => ({ kind: "assignment" as const, data: a, date: new Date(a.due_at) })),
      ];
      // Only future + today, sorted by date
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      all.sort((a, b) => a.date.getTime() - b.date.getTime());
      setEvents(all.filter(e => e.date >= now));
    }).catch(e => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, [isLoading, userId, roleCode]);

  if (isLoading || loading) return <LoadingState />;

  // Group by date string
  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = ev.date.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }

  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <p style={S.label}>Upcoming</p>
        <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Calendar</h1>
        <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
          Live sessions and assignment deadlines ahead
        </p>
      </div>

      {error ? (
        <div style={{ ...glassCard, textAlign: "center" }}>
          <p style={{ color: "#e53e3e", fontWeight: 600 }}>{error}</p>
        </div>
      ) : groups.size === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={S.label}>All Clear</p>
          <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>Nothing upcoming</p>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "8px" }}>No live classes or assignment deadlines in the near future.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {Array.from(groups.entries()).map(([dateLabel, evs]) => (
            <div key={dateLabel}>
              <p style={{ ...S.label, marginBottom: "10px" }}>{dateLabel}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {evs.map((ev, i) =>
                  ev.kind === "live"
                    ? <LiveEventRow key={i} cls={ev.data} />
                    : <AssignmentEventRow key={i} assignment={ev.data} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveEventRow({ cls }: { cls: LiveClass }) {
  const time = new Date(cls.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <Link href="/dashboard/live-classes" style={{ textDecoration: "none" }}>
      <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "16px", padding: "14px 20px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(3,72,82,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
          🎥
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852" }}>{cls.title}</p>
          {cls.course_title && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#209379", fontWeight: 600 }}>{cls.course_title}</p>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{time}</p>
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>{cls.duration_minutes} min</p>
        </div>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0abe62", flexShrink: 0 }} />
      </div>
    </Link>
  );
}

function AssignmentEventRow({ assignment }: { assignment: Assignment }) {
  const time = new Date(assignment.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isPast = new Date() > new Date(assignment.due_at);
  const status = assignment.submission_status ?? "NOT_STARTED";
  const submitted = status === "SUBMITTED" || status === "LATE" || status === "GRADED";

  return (
    <Link href={`/dashboard/assignments/${assignment.id}`} style={{ textDecoration: "none" }}>
      <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "16px", padding: "14px 20px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: isPast && !submitted ? "rgba(220,38,38,0.08)" : "rgba(32,147,121,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
          📝
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852" }}>{assignment.title}</p>
          {assignment.course_title && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#209379", fontWeight: 600 }}>{assignment.course_title}</p>}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: isPast && !submitted ? "#dc2626" : "#034852" }}>Due {time}</p>
          {submitted && <p style={{ margin: 0, fontSize: "11px", color: "#0abe62", fontWeight: 700 }}>Submitted</p>}
          {isPast && !submitted && <p style={{ margin: 0, fontSize: "11px", color: "#dc2626", fontWeight: 700 }}>Overdue</p>}
        </div>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isPast && !submitted ? "#dc2626" : "#ffde00", flexShrink: 0 }} />
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <div style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...glassCard, textAlign: "center" }}>
        <p style={S.label}>Loading</p>
        <p style={{ ...S.heading, marginTop: "12px" }}>Building your calendar…</p>
      </div>
    </div>
  );
}

const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "18px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const S = {
  label:   { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
};
