"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  getCalendar, createCalendarEvent, deleteCalendarEvent,
  type CalendarItem, type CreateCalendarEventPayload,
} from "@/lib/api";

// ── Event type config ──────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { emoji: string; color: string; bg: string; label: string }> = {
  LIVE_CLASS:           { emoji: "🎥", color: "#034852",  bg: "rgba(3,72,82,0.08)",       label: "Live Class" },
  ASSIGNMENT_DEADLINE:  { emoji: "📝", color: "#dc2626",  bg: "rgba(220,38,38,0.08)",     label: "Assignment Due" },
  EXAM:                 { emoji: "📋", color: "#7c3aed",  bg: "rgba(124,58,237,0.08)",    label: "Exam" },
  HOLIDAY:              { emoji: "🏖️", color: "#059669",  bg: "rgba(5,150,105,0.08)",     label: "Holiday" },
  WORKSHOP:             { emoji: "🛠️", color: "#d97706",  bg: "rgba(217,119,6,0.08)",     label: "Workshop" },
  OTHER:                { emoji: "📌", color: "#6b7280",  bg: "rgba(107,114,128,0.08)",   label: "Event" },
};

function cfg(type: string) {
  return EVENT_CONFIG[type] ?? EVENT_CONFIG.OTHER;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { data: userData, isLoading } = useCurrentUser();
  const { has } = usePermissions();
  const canCreate = has(PERM.calendar.create);

  const [items,   setItems]   = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    const now = new Date();
    const from = now.toISOString();
    const to   = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();
    getCalendar(from, to)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load calendar."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isLoading) return;
    load();
  }, [isLoading]);

  // Group by date
  const groups = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const d = new Date(item.starts_at);
    const key = d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <p style={S.label}>Upcoming</p>
          <h1 style={{ ...S.heading, fontSize: "28px", margin: "4px 0 0" }}>Calendar</h1>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "4px" }}>
            Live sessions, deadlines, and programme events
          </p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreate(true)} style={primaryBtn}>
            + Add Event
          </button>
        )}
      </div>

      {error && (
        <div style={{ ...glassCard, background: "rgba(229,62,62,0.07)", marginBottom: "20px" }}>
          <p style={{ color: "#c53030", fontSize: "14px" }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={{ color: "rgba(3,72,82,0.45)", fontSize: "14px" }}>Loading calendar…</p>
        </div>
      ) : groups.size === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p style={S.label}>All Clear</p>
          <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>Nothing upcoming</p>
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)", marginTop: "8px" }}>
            No events, live classes, or deadlines in the next 90 days.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {Array.from(groups.entries()).map(([dateLabel, evs]) => (
            <div key={dateLabel}>
              <p style={{ ...S.label, marginBottom: "10px", borderBottom: "1px solid rgba(3,72,82,0.06)", paddingBottom: "8px" }}>{dateLabel}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {evs.map((ev) => (
                  <EventRow
                    key={ev.id + ev.source}
                    item={ev}
                    canDelete={canCreate}
                    onDelete={async () => {
                      if (ev.source !== "custom") return;
                      if (!confirm(`Delete "${ev.title}"?`)) return;
                      await deleteCalendarEvent(ev.id);
                      load();
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Event row ──────────────────────────────────────────────────────────────────

function EventRow({ item, canDelete, onDelete }: {
  item: CalendarItem;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const c = cfg(item.event_type);
  const time = item.is_all_day
    ? "All day"
    : new Date(item.starts_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const href =
    item.source === "live_class"  ? "/dashboard/live-classes" :
    item.source === "assignment"  ? `/dashboard/assignments/${item.ref_id}` :
    null;

  const inner = (
    <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", cursor: href ? "pointer" : "default" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
        {c.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#034852", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.color, fontWeight: 600 }}>{c.label}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#034852" }}>{time}</p>
        {item.ends_at && !item.is_all_day && (
          <p style={{ margin: 0, fontSize: "11px", color: "rgba(3,72,82,0.45)" }}>
            → {new Date(item.ends_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      {canDelete && item.source === "custom" && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "rgba(3,72,82,0.3)", padding: "4px", flexShrink: 0 }}
          title="Delete event"
        >✕</button>
      )}
      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: c.color, flexShrink: 0 }} />
    </div>
  );

  if (href) return <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link>;
  return inner;
}

// ── Create event modal ────────────────────────────────────────────────────────

const EVENT_TYPES = ["EXAM", "HOLIDAY", "WORKSHOP", "OTHER"] as const;
const PROGRAMMES  = ["", "UG", "PG"] as const;
const STATES      = ["", "TAMIL_NADU", "KERALA", "KARNATAKA"] as const;

function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<{
    title: string; description: string; event_type: string;
    starts_at: string; ends_at: string; is_all_day: boolean;
    programme_type: string; state: string;
  }>({
    title: "", description: "", event_type: "EXAM",
    starts_at: "", ends_at: "", is_all_day: false,
    programme_type: "", state: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.title.trim() || !form.starts_at) { setErr("Title and start date are required."); return; }
    setSaving(true); setErr(null);
    const payload: CreateCalendarEventPayload = {
      title:          form.title.trim(),
      description:    form.description.trim() || undefined,
      event_type:     form.event_type as CreateCalendarEventPayload["event_type"],
      starts_at:      new Date(form.starts_at).toISOString(),
      ends_at:        form.ends_at ? new Date(form.ends_at).toISOString() : undefined,
      is_all_day:     form.is_all_day,
      programme_type: (form.programme_type || undefined) as CreateCalendarEventPayload["programme_type"],
      state:          form.state || undefined,
    };
    try {
      await createCalendarEvent(payload);
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ ...S.heading, fontSize: "20px", margin: 0 }}>Add Calendar Event</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "rgba(3,72,82,0.4)" }}>✕</button>
        </div>

        {err && <p style={{ color: "#c53030", fontSize: "13px", marginBottom: "16px" }}>{err}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Field label="Title *">
            <input value={form.title} onChange={(e) => set("title", e.target.value)} style={inputStyle} placeholder="Event title" />
          </Field>

          <Field label="Type">
            <select value={form.event_type} onChange={(e) => set("event_type", e.target.value)} style={inputStyle}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{cfg(t).label}</option>)}
            </select>
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }} placeholder="Optional details" />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field label="Start *">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="End">
              <input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#034852", fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_all_day} onChange={(e) => set("is_all_day", e.target.checked)} />
            All-day event
          </label>

          <p style={{ ...S.label, marginTop: "8px" }}>Audience (leave blank = everyone)</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field label="Programme">
              <select value={form.programme_type} onChange={(e) => set("programme_type", e.target.value)} style={inputStyle}>
                <option value="">All programmes</option>
                {PROGRAMMES.filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="State">
              <select value={form.state} onChange={(e) => set("state", e.target.value)} style={inputStyle}>
                <option value="">All states</option>
                {STATES.filter(Boolean).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
          </div>

          <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.45)", margin: 0 }}>
            School / course targeting available via bulk assign. Leave filters blank to broadcast to all students.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Create Event"}
          </button>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 700, color: "rgba(3,72,82,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = { background: "#fff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.15)", fontSize: "13px", color: "#034852", outline: "none", boxSizing: "border-box", background: "#fff" };
const primaryBtn: React.CSSProperties = { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg,#0abe62,#006d6c)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer", boxShadow: "0 4px 12px rgba(10,190,98,0.2)" };
const secondaryBtn: React.CSSProperties = { padding: "10px 20px", border: "none", borderRadius: "10px", background: "rgba(3,72,82,0.07)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
const S = {
  label:   { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
};
