"use client";

import { HeaderActions } from "@/components/dashboard/HeaderActions";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, FileText, Palmtree, Pencil, Pin, Plus, Video, Wrench, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  createCalendarEvent, deleteCalendarEvent, updateCalendarEvent,
  type CalendarItem, type CreateCalendarEventPayload, type UpdateCalendarEventPayload,
} from "@/lib/api";
import { useCalendar } from "@/lib/queries/calendar";
import { useBatches } from "@/lib/queries/batches";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import { BatchMultiPicker } from "@/components/BatchMultiPicker";

// ── Event type config ──────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { Icon: typeof CalendarDays; color: string; bg: string; label: string }> = {
  LIVE_CLASS:           { Icon: Video,         color: "var(--color-text)",  bg: "#eef5f3",                  label: "Live Class" },
  ASSIGNMENT_DEADLINE:  { Icon: FileText,      color: "#b83232",  bg: "rgba(184,50,50,0.08)",     label: "Assignment Due" },
  EXAM:                 { Icon: ClipboardList, color: "#7c3aed",  bg: "rgba(124,58,237,0.08)",    label: "Exam" },
  HOLIDAY:              { Icon: Palmtree,      color: "#047857",  bg: "rgba(5,150,105,0.08)",     label: "Holiday" },
  WORKSHOP:             { Icon: Wrench,        color: "#9a5a00",  bg: "rgba(217,119,6,0.08)",     label: "Workshop" },
  OTHER:                { Icon: Pin,           color: "#4b5563",  bg: "rgba(107,114,128,0.08)",   label: "Event" },
};

function cfg(type: string) {
  return EVENT_CONFIG[type] ?? EVENT_CONFIG.OTHER;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { isLoading } = useCurrentUser();
  const { has } = usePermissions();
  const canCreate = has(PERM.calendar.create);
  const canEdit   = has(PERM.calendar.edit);
  const canDelete = has(PERM.calendar.delete);

  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarItem | null>(null);
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();

  // Stable range (start-of-today → +90 days) so the cache key doesn't churn
  // on every render from a moving `now` timestamp.
  const { from, to } = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return {
      from: start.toISOString(),
      to: new Date(start.getTime() + 90 * 24 * 3600 * 1000).toISOString(),
    };
  }, []);

  const { data: items = [], isPending, error: queryError } = useCalendar(from, to);
  const loading = isPending;
  const error = queryError ? (queryError as Error).message : null;

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
      {canCreate && (
        <HeaderActions>
          <button type="button" onClick={() => setShowCreate(true)} style={primaryBtn}>
            <Plus size={18} aria-hidden="true" /><span className="hidden sm:inline">Add event</span><span className="sr-only sm:hidden">Add event</span>
          </button>
        </HeaderActions>
      )}

      {error && (
        <div role="alert" style={{ ...glassCard, background: "rgba(184,50,50,0.06)", borderColor: "rgba(184,50,50,0.2)", marginBottom: "20px" }}>
          <p style={{ color: "#b83232", fontSize: "14px", margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <p role="status" style={{ color: "var(--color-text-muted)", fontSize: "14px", margin: 0 }}>Loading calendar…</p>
        </div>
      ) : groups.size === 0 ? (
        <div style={{ ...glassCard, textAlign: "center", padding: "48px" }}>
          <CalendarDays size={24} aria-hidden="true" style={{ color: "var(--teal)", display: "block", margin: "0 auto" }} />
          <p style={{ ...S.heading, fontSize: "18px", marginTop: "12px" }}>Nothing upcoming</p>
          <p style={{ fontSize: "14px", color: "var(--color-text-muted)", marginTop: "8px" }}>
            No events, live classes, or deadlines in the next 90 days.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {Array.from(groups.entries()).map(([dateLabel, evs]) => (
            <div key={dateLabel}>
              <h2 style={{ ...S.label, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginBottom: "10px", borderBottom: "1px solid var(--color-border)", paddingBottom: "8px" }}>{dateLabel}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {evs.map((ev) => (
                  <EventRow
                    key={ev.id + ev.source}
                    item={ev}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => setEditingEvent(ev)}
                    onDelete={async () => {
                      if (ev.source !== "custom") return;
                      if (!confirm(`Delete "${ev.title}"?`)) return;
                      await deleteCalendarEvent(ev.id);
                      void queryClient.invalidateQueries({ queryKey: ["og","calendar"] });
                      invalidate('calendar');
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
          onCreated={() => { setShowCreate(false); void queryClient.invalidateQueries({ queryKey: ["og","calendar"] }); }}
        />
      )}

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={() => {
            setEditingEvent(null);
            void queryClient.invalidateQueries({ queryKey: ["og","calendar"] });
          }}
        />
      )}
    </div>
  );
}

// ── Event row ──────────────────────────────────────────────────────────────────

function EventRow({ item, canEdit, canDelete, onEdit, onDelete }: {
  item: CalendarItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = cfg(item.event_type);
  const currentUrl = useCurrentUrl();
  const time = item.is_all_day
    ? "All day"
    : new Date(item.starts_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const href =
    item.source === "live_class"  ? "/dashboard/live-classes" :
    item.source === "assignment"  ? withFrom(`/dashboard/assignments/${item.ref_id}`, currentUrl) :
    null;

  const inner = (
    <div style={{ ...glassCard, display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", cursor: href ? "pointer" : "default" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <c.Icon size={18} aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: c.color, fontWeight: 600 }}>{c.label}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "var(--color-text)" }}>{time}</p>
        {item.ends_at && !item.is_all_day && (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--color-text-muted)" }}>
            → {new Date(item.ends_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      {canEdit && item.source === "custom" && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
          style={iconBtn}
          title="Edit event"
          aria-label="Edit event"
        ><Pencil size={18} aria-hidden="true" /></button>
      )}
      {canDelete && item.source === "custom" && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
          style={{ ...iconBtn, color: "#b83232" }}
          title="Delete event"
          aria-label="Delete event"
        ><X size={18} aria-hidden="true" /></button>
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
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();
  const { data: batches = [] } = useBatches("ACTIVE");

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
      batch_ids:      batchIds.length ? batchIds : undefined,
    };
    try {
      await createCalendarEvent(payload);
      invalidate('calendar');
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgb(3 20 30 / 35%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px,4vw,24px)", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ ...S.heading, fontSize: "18px", margin: 0 }}>Add Calendar Event</h2>
          <button onClick={onClose} aria-label="Close" style={iconBtn}><X size={20} aria-hidden="true" /></button>
        </div>

        {err && <p role="alert" style={{ color: "#b83232", fontSize: "14px", marginBottom: "16px" }}>{err}</p>}

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <Field label="Start *">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="End">
              <input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", fontSize: "14px", color: "var(--color-text)", fontWeight: 500, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_all_day} onChange={(e) => set("is_all_day", e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "var(--teal)" }} />
            All-day event
          </label>

          <p style={{ ...S.label, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginTop: "8px" }}>Audience (leave blank = everyone)</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
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

          {batches.length > 0 && (
            <Field label="Batches">
              <BatchMultiPicker
                value={batchIds}
                onChange={setBatchIds}
                inputStyle={inputStyle}
              />
            </Field>
          )}

          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }}>
            School / course targeting is managed through Batches. Leave filters blank to broadcast to all students.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, flex: "2 1 140px", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Create Event"}
          </button>
          <button onClick={onClose} style={{ ...secondaryBtn, flex: "1 1 100px" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit event modal ──────────────────────────────────────────────────────────

function EditEventModal({ event, onClose, onSaved }: {
  event: CalendarItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<{
    title: string; description: string; event_type: string;
    starts_at: string; ends_at: string; is_all_day: boolean;
    programme_type: string; state: string;
  }>({
    title:          event.title,
    description:    event.description ?? "",
    event_type:     event.event_type,
    starts_at:      event.starts_at ? new Date(event.starts_at).toISOString().slice(0, 16) : "",
    ends_at:        event.ends_at   ? new Date(event.ends_at).toISOString().slice(0, 16)   : "",
    is_all_day:     event.is_all_day,
    programme_type: event.programme_type ?? "",
    state:          event.state ?? "",
  });
  const [batchIds, setBatchIds] = useState<string[]>(event.batch_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();
  const { data: batches = [] } = useBatches("ACTIVE");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.title.trim() || !form.starts_at) { setErr("Title and start date are required."); return; }
    setSaving(true); setErr(null);
    const payload: UpdateCalendarEventPayload = {
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      event_type:     form.event_type as UpdateCalendarEventPayload["event_type"],
      starts_at:      new Date(form.starts_at).toISOString(),
      ends_at:        form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_all_day:     form.is_all_day,
      programme_type: (form.programme_type || null) as UpdateCalendarEventPayload["programme_type"],
      state:          form.state || null,
      batch_ids:      batchIds.length ? batchIds : null,
    };
    try {
      await updateCalendarEvent(event.id, payload);
      invalidate('calendar');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgb(3 20 30 / 35%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px,4vw,24px)", width: "100%", maxWidth: "480px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ ...S.heading, fontSize: "18px", margin: 0 }}>Edit Calendar Event</h2>
          <button onClick={onClose} aria-label="Close" style={iconBtn}><X size={20} aria-hidden="true" /></button>
        </div>

        {err && <p role="alert" style={{ color: "#b83232", fontSize: "14px", marginBottom: "16px" }}>{err}</p>}

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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <Field label="Start *">
              <input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="End">
              <input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", fontSize: "14px", color: "var(--color-text)", fontWeight: 500, cursor: "pointer" }}>
            <input type="checkbox" checked={form.is_all_day} onChange={(e) => set("is_all_day", e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "var(--teal)" }} />
            All-day event
          </label>

          <p style={{ ...S.label, fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginTop: "8px" }}>Audience (leave blank = everyone)</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
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

          {batches.length > 0 && (
            <Field label="Batches">
              <BatchMultiPicker
                value={batchIds}
                onChange={setBatchIds}
                inputStyle={inputStyle}
              />
            </Field>
          )}

          <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: 0 }}>
            School / course targeting is managed through Batches. Leave filters blank to broadcast to all students.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, flex: "2 1 140px", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} style={{ ...secondaryBtn, flex: "1 1 100px" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)" }}>{label}</p>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = { background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", padding: "clamp(16px,4vw,24px)" };
const inputStyle: React.CSSProperties = { width: "100%", minHeight: "44px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--color-border-strong)", fontSize: "14px", color: "var(--color-text)", boxSizing: "border-box", background: "var(--color-surface)" };
const btnBase: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "44px", padding: "8px 16px", borderRadius: "12px", fontWeight: 600, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const primaryBtn: React.CSSProperties = { ...btnBase, border: "1px solid var(--green)", background: "var(--green)", color: "var(--dark-teal)" };
const secondaryBtn: React.CSSProperties = { ...btnBase, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" };
const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "44px", minHeight: "44px", background: "none", border: "none", borderRadius: "8px", cursor: "pointer", color: "var(--color-text-muted)", flexShrink: 0 };
const S = {
  label:   { fontSize: "13px", fontWeight: 500, color: "var(--color-text-muted)", margin: 0 } as React.CSSProperties,
  heading: { fontWeight: 600, color: "var(--color-text)" } as React.CSSProperties,
};
