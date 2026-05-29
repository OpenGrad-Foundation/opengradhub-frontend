"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchSchools,
  createSchool,
  updateSchool,
  type SchoolOption,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { SchoolBulkUploadPanel } from "./BulkUploadPanel";

export default function SchoolsPage() {
  const { has } = usePermissions();
  const canCreate = has(PERM.schools.create);
  const canEdit = has(PERM.schools.edit);
  const canBulk = has(PERM.schools.bulk_import);

  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolOption | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSchools(await fetchSchools());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schools.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
        <div>
          <p style={labelStyle}>Administration</p>
          <h1 style={{ ...titleStyle, fontSize: "28px", margin: 0 }}>Schools</h1>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {canCreate && (
            <button onClick={() => { setShowAdd(true); setShowBulk(false); }} style={primaryButton}>
              + Add School
            </button>
          )}
          {canBulk && (
            <button onClick={() => { setShowBulk(true); setShowAdd(false); }} style={secondaryButton}>
              ↥ Bulk Upload
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <SchoolFormModal
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void load(); }}
        />
      )}

      {editSchool && (
        <SchoolFormModal
          mode="edit"
          school={editSchool}
          onClose={() => setEditSchool(null)}
          onSaved={() => { setEditSchool(null); void load(); }}
        />
      )}

      {showBulk && (
        <SchoolBulkUploadPanel onClose={() => setShowBulk(false)} onDone={() => void load()} />
      )}

      {loading ? (
        <p style={{ color: "rgba(3,72,82,0.6)" }}>Loading schools…</p>
      ) : error ? (
        <p style={{ color: "#c53030", fontWeight: 600 }}>{error}</p>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>District</th>
                <th style={thStyle}>State</th>
                <th style={thStyle}>Code</th>
                {canEdit && <th style={thStyle} />}
              </tr>
            </thead>
            <tbody>
              {schools.length === 0 ? (
                <tr><td colSpan={canEdit ? 5 : 4} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No schools yet.</td></tr>
              ) : schools.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                  <td style={tdStyle}>{s.name}</td>
                  <td style={tdStyle}>{s.district ?? "—"}</td>
                  <td style={tdStyle}>{s.state ?? "—"}</td>
                  <td style={tdStyle}>{s.code ?? "—"}</td>
                  {canEdit && (
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button onClick={() => setEditSchool(s)} style={linkBtnStyle}>Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SchoolFormModal({
  mode, school, onClose, onSaved,
}: {
  mode: "create" | "edit";
  school?: SchoolOption;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(school?.name ?? "");
  const [district, setDistrict] = useState(school?.district ?? "");
  const [state, setState] = useState(school?.state ?? "");
  const [code, setCode] = useState(school?.code ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    setErr(null);
    try {
      if (mode === "create") {
        await createSchool({ name, district, state, code });
      } else if (school) {
        await updateSchool(school.id, { name, district, state, code });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }}
      />
      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add School" : "Edit School"}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
          boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "schoolPanelIn 240ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <style>{`@keyframes schoolPanelIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        {/* Header */}
        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={labelStyle}>{mode === "create" ? "Add School" : "Edit School"}</p>
            {mode === "edit" && school && (
              <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 2px" }}>{school.name}</h2>
            )}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={formLabelStyle}>Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={formLabelStyle}>District</label>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={formLabelStyle}>State</label>
              <input value={state} onChange={(e) => setState(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={formLabelStyle}>Code (optional — auto-generated if blank)</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} placeholder="OG-SCH-001" />
            </div>
            {err && <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px", margin: 0 }}>{err}</p>}
          </div>
        </div>

        {/* Footer */}
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
const glassCard: React.CSSProperties = { background: "#ffffff", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "24px", padding: "32px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" };
const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
const secondaryButton: React.CSSProperties = { padding: "12px 24px", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "12px", background: "rgba(3,72,82,0.04)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", color: "#034852" };
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
