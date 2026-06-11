"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  fetchSchools,
  createSchool,
  updateSchool,
  setSchoolFellow,
  getUsers,
  type SchoolOption,
  type SafeUser,
} from "@/lib/api";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { SchoolBulkUploadPanel } from "./BulkUploadPanel";
import { StateDistrictPicker } from "@/app/dashboard/_components/StateDistrictPicker";
import { normState, ALL_STATE } from "@/lib/geo";
import { useInvalidate } from "@/lib/mutations/invalidation";

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
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");

  const q = query.trim().toLowerCase();
  const visibleSchools = schools.filter((s) => {
    if (q && ![s.name, s.district, s.state, s.code, s.fellow_name]
      .some((v) => (v ?? "").toLowerCase().includes(q))) return false;
    if (filterState && normState(s.state) !== filterState) return false;
    if (filterDistrict && (s.district ?? "") !== filterDistrict) return false;
    return true;
  });

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
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, district, state, code, or fellow…"
                aria-label="Search schools"
                style={{ ...inputStyle, paddingLeft: "36px" }}
              />
              <span aria-hidden="true" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(3,72,82,0.45)", fontSize: "14px", pointerEvents: "none" }}>⌕</span>
            </div>
            <div style={{ flex: "1 1 320px", maxWidth: "420px" }}>
              <StateDistrictPicker
                state={filterState}
                district={filterDistrict}
                onStateChange={setFilterState}
                onDistrictChange={setFilterDistrict}
                blankStateLabel="All states"
                inputStyle={inputStyle}
              />
            </div>
            <span style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
              {q || filterState || filterDistrict
                ? `${visibleSchools.length} of ${schools.length}`
                : `${schools.length} school${schools.length === 1 ? "" : "s"}`}
            </span>
          </div>

          <div style={{ overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(3,72,82,0.08)", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-body)", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "rgba(3,72,82,0.05)", textAlign: "left" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>District</th>
                  <th style={thStyle}>State</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Fellow</th>
                  {canEdit && <th style={thStyle} />}
                </tr>
              </thead>
              <tbody>
                {schools.length === 0 ? (
                  <tr><td colSpan={canEdit ? 6 : 5} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No schools yet.</td></tr>
                ) : visibleSchools.length === 0 ? (
                  <tr><td colSpan={canEdit ? 6 : 5} style={{ padding: "20px", color: "rgba(3,72,82,0.5)" }}>No schools match &ldquo;{query}&rdquo;.</td></tr>
                ) : visibleSchools.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(3,72,82,0.06)" }}>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>{s.district ?? "—"}</td>
                    <td style={tdStyle}>{s.state ?? "—"}</td>
                    <td style={tdStyle}>{s.code ?? "—"}</td>
                    <td style={tdStyle}>{s.fellow_name ?? "—"}</td>
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
        </>
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
  const [fellowId, setFellowId] = useState<string>(school?.fellow_id ?? "");
  const [fellows, setFellows] = useState<SafeUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    let cancelled = false;
    getUsers("FELLOW")
      .then((rows) => { if (!cancelled) setFellows(rows); })
      .catch(() => { if (!cancelled) setFellows([]); });
    return () => { cancelled = true; };
  }, []);

  const initialFellowId = school?.fellow_id ?? "";

  async function save() {
    if (!name.trim()) { setErr("Name is required."); return; }
    if (!state.trim()) { setErr("State is required."); return; }
    if (normState(state) !== ALL_STATE && !district.trim()) {
      setErr("District is required (except for All-state schools).");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (mode === "create") {
        const created = await createSchool({ name, district, state, code });
        if (fellowId) await setSchoolFellow(created.id, fellowId);
      } else if (school) {
        await updateSchool(school.id, { name, district, state, code });
        if (fellowId !== initialFellowId) {
          await setSchoolFellow(school.id, fellowId || null);
        }
      }
      invalidate('schools', 'users');
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
              <label style={formLabelStyle}>State &amp; District</label>
              <StateDistrictPicker
                state={state}
                district={district}
                onStateChange={setState}
                onDistrictChange={setDistrict}
                inputStyle={inputStyle}
              />
            </div>
            <div>
              <label style={formLabelStyle}>Code (optional — auto-generated if blank)</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} style={inputStyle} placeholder="OG-SCH-001" />
            </div>
            <div>
              <label style={formLabelStyle}>Assigned Fellow</label>
              <FellowPicker fellows={fellows} value={fellowId} onChange={setFellowId} />
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

function FellowPicker({
  fellows, value, onChange,
}: {
  fellows: SafeUser[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = fellows.find((f) => f.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? fellows.filter((f) =>
        [f.name, f.email].some((v) => (v ?? "").toLowerCase().includes(q)),
      )
    : fellows;

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(true)}
        style={{ ...inputStyle, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", padding: open ? "0" : "12px 16px" }}
      >
        {open ? (
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selected ? `Search… (current: ${selected.name})` : "Search fellows…"}
            style={{ flex: 1, padding: "12px 16px", border: "none", background: "transparent", outline: "none", fontFamily: "var(--font-body)", fontSize: "14px", color: "#034852" }}
          />
        ) : (
          <span style={{ flex: 1, color: selected ? "#034852" : "rgba(3,72,82,0.5)" }}>
            {selected ? `${selected.name}${selected.email ? ` (${selected.email})` : ""}` : "— Unassigned —"}
          </span>
        )}
        {selected && !open && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); pick(""); }}
            aria-label="Clear assigned fellow"
            style={{ background: "none", border: "none", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "0 8px", fontSize: "14px" }}
          >
            ✕
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: "240px", overflowY: "auto",
            background: "#fff", border: "1px solid rgba(3,72,82,0.12)", borderRadius: "12px",
            boxShadow: "0 12px 32px rgba(3,72,82,0.12)", zIndex: 42,
          }}
        >
          <button
            type="button"
            onClick={() => pick("")}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: value === "" ? "rgba(10,190,98,0.06)" : "transparent", border: "none", fontSize: "13px", color: "rgba(3,72,82,0.7)", cursor: "pointer", fontStyle: "italic" }}
          >
            — Unassigned —
          </button>
          {filtered.length === 0 ? (
            <p style={{ padding: "12px 14px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>
              No fellows match &ldquo;{query}&rdquo;.
            </p>
          ) : filtered.map((f) => {
            const active = f.id === value;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => pick(f.id)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: active ? "rgba(10,190,98,0.08)" : "transparent", border: "none", borderTop: "1px solid rgba(3,72,82,0.06)", fontSize: "13px", color: "#034852", cursor: "pointer" }}
              >
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                {f.email && <div style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)" }}>{f.email}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const primaryButton: React.CSSProperties = { padding: "12px 24px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#ffffff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", boxShadow: "0 8px 16px rgba(10,190,98,0.2)", whiteSpace: "nowrap" };
const secondaryButton: React.CSSProperties = { padding: "12px 24px", border: "1px solid rgba(3,72,82,0.2)", borderRadius: "12px", background: "rgba(3,72,82,0.04)", color: "#034852", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer", whiteSpace: "nowrap" };
const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
const formLabelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "rgba(3,72,82,0.7)", marginBottom: "6px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852", fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const thStyle: React.CSSProperties = { padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#209379" };
const tdStyle: React.CSSProperties = { padding: "12px 20px", color: "#034852" };
const linkBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#0abe62", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
