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

/**
 * Create / edit slide-over for a batch. `defaultSchoolId` pre-fills the host
 * school on create (used by the school detail page's "+ Add Batch" shortcut).
 */
export function BatchFormModal({
  mode, batch, defaultSchoolId, onClose, onSaved,
}: {
  mode: "create" | "edit";
  batch?: Batch;
  defaultSchoolId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(batch?.name ?? "");
  const [schoolId, setSchoolId] = useState<string>(batch?.school_id ?? defaultSchoolId ?? "");
  const [programme, setProgramme] = useState<string>(batch?.programme_type ?? "");
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

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add Batch" : "Edit Batch"}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
          boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "batchPanelIn 240ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <style>{`@keyframes batchPanelIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={labelStyle}>{mode === "create" ? "Add Batch" : "Edit Batch"}</p>
            {mode === "edit" && batch && (
              <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 2px" }}>{batch.name}</h2>
            )}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={formLabelStyle}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus placeholder="e.g. Grade 11 — 2026 or IPMAT 2026" />
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
              <label style={formLabelStyle}>Programme</label>
              <select value={programme} onChange={(e) => setProgramme(e.target.value)} style={inputStyle}>
                <option value="">—</option>
                <option value="UG">UG</option>
                <option value="PG">PG</option>
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
            {err && <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px", margin: 0 }}>{err}</p>}
          </div>
        </div>

        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid rgba(3,72,82,0.08)", flexShrink: 0, display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={secondaryButton}>Cancel</button>
          <button onClick={() => void save()} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
const secondaryButton: React.CSSProperties = { padding: "12px 24px", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "12px", background: "rgba(3,72,82,0.04)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
