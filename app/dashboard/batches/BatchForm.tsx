"use client";

import { useEffect, useState } from "react";
import {
  fetchSchools,
  createBatch,
  updateBatch,
  type Batch,
  type SchoolOption,
} from "@/lib/api";
import { SchoolSearchPicker } from "@/components/SchoolSearchPicker";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";

export type BatchFormProps = {
  mode: "create" | "edit";
  batch?: Batch;
  /** Pre-fills the host school on create (school detail page's "+ Add Batch"). */
  defaultSchoolId?: string;
  /** Panel hosts focus the name field on open; an inline form must not steal focus. */
  autoFocusName?: boolean;
  onSaved: () => void;
};

/**
 * The batch fields plus their save logic, without any surrounding chrome.
 *
 * Returned as a hook rather than a component so both hosts can pin their own
 * action row where it belongs: the slide-over keeps a footer outside its scroll
 * area, the Settings tab puts the button under the fields.
 */
export function useBatchForm({ mode, batch, defaultSchoolId, autoFocusName, onSaved }: BatchFormProps) {
  const [name, setName] = useState(batch?.name ?? "");
  const [schoolId, setSchoolId] = useState<string>(batch?.school_id ?? defaultSchoolId ?? "");
  const [programme, setProgramme] = useState<string>(batch?.programme_type ?? "");
  // No default: the product requires an explicit choice, and a pre-selected
  // value is not a choice. The API rejects a create without one too.
  const [deliveryMode, setDeliveryMode] = useState<string>(batch?.delivery_mode ?? "");
  const modeLocked = mode === "edit" && !!batch?.delivery_mode_locked;
  const [status, setStatus] = useState<string>(batch?.status ?? "ACTIVE");
  const [startsOn, setStartsOn] = useState<string>(batch?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState<string>(batch?.ends_on ?? "");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    let cancelled = false;
    fetchSchools()
      .then((rows) => { if (!cancelled) setSchools(rows); })
      .catch(() => { if (!cancelled) setSchools([]); });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!deliveryMode) {
      setErr("Choose whether this batch is online or school-based.");
      return;
    }
    if (startsOn && endsOn && startsOn > endsOn) {
      setErr("Start date must be before end date.");
      return;
    }
    setSaving(true);
    setErr(null);
    const payload = {
      name,
      school_id: schoolId || null,
      programme_type: programme || null,
      // Omitted on edit once frozen: sending the unchanged value is harmless,
      // but not sending it at all keeps the intent obvious.
      ...(modeLocked ? {} : { delivery_mode: deliveryMode as "ONLINE" | "SCHOOL_BASED" }),
      starts_on: startsOn || null,
      ends_on: endsOn || null,
    };
    try {
      if (mode === "create") {
        await createBatch(payload);
      } else if (batch) {
        await updateBatch(batch.id, { ...payload, status });
      }
      invalidate('batches');
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <div style={{ display: "grid", gap: "14px" }}>
      <div>
        <label style={formLabelStyle}>Name *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus={autoFocusName} placeholder="e.g. Grade 11 — 2026 or IPMAT 2026" />
      </div>
      <div>
        <label style={formLabelStyle}>Host School (leave empty for an independent batch)</label>
        <SchoolSearchPicker
          schools={schools}
          value={schoolId}
          onChange={setSchoolId}
          inputStyle={inputStyle}
        />
        {schoolId && (
          <button
            type="button"
            onClick={() => setSchoolId("")}
            style={{ ...linkBtnStyle, marginTop: "4px", padding: 0 }}
          >
            Clear school (make independent)
          </button>
        )}
      </div>
      <div>
        <label style={formLabelStyle}>Attendance *</label>
        <select
          value={deliveryMode}
          onChange={(e) => setDeliveryMode(e.target.value)}
          disabled={modeLocked}
          style={{ ...inputStyle, opacity: modeLocked ? 0.6 : 1 }}
          aria-label="Attendance"
        >
          <option value="">Choose…</option>
          <option value="ONLINE">Online — joining the class marks attendance</option>
          <option value="SCHOOL_BASED">School-based — the school register is the record</option>
        </select>
        <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)", margin: "4px 0 0" }}>
          {modeLocked
            ? "This batch already has attendance history, so this can no longer change."
            : "Decides which record counts as this batch's attendance. It cannot be changed once attendance exists."}
        </p>
      </div>
      <div>
        <label style={formLabelStyle}>Programme</label>
        <select value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
          <option value="">—</option>
          {PROGRAMME_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
      </div>
      {mode === "edit" && (
        <div>
          <label style={formLabelStyle}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <p style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)", margin: "4px 0 0" }}>
            Archiving blocks membership and content changes. Students keep the access they already have.
          </p>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={formLabelStyle}>Starts on</label>
          <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={formLabelStyle}>Ends on</label>
          <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} style={inputStyle} />
        </div>
      </div>
      {err && <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px", margin: 0 }} role="alert">{err}</p>}
    </div>
  );

  return { fields, save, saving, err };
}

/**
 * Inline batch editor — the fields with their own save button, for hosts that
 * render the form in the flow of a page rather than in a panel.
 */
export function BatchForm({ submitLabel = "Save", ...props }: BatchFormProps & { submitLabel?: string }) {
  const { fields, save, saving } = useBatchForm(props);
  return (
    <div>
      {fields}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
        <button onClick={() => void save()} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.5 : 1 }}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

export const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
export const secondaryButton: React.CSSProperties = { padding: "12px 24px", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "12px", background: "rgba(3,72,82,0.04)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
