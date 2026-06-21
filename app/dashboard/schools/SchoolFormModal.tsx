"use client";

import { useEffect, useRef, useState } from "react";
import {
  createSchool,
  updateSchool,
  setSchoolFellow,
  getFellows,
  type SchoolOption,
  type FellowOption,
} from "@/lib/api";
import { StateDistrictPicker } from "@/app/dashboard/_components/StateDistrictPicker";
import { normState, ALL_STATE } from "@/lib/geo";
import { useInvalidate } from "@/lib/mutations/invalidation";
import {
  labelStyle, titleStyle, primaryButton, secondaryButton,
  closeBtnStyle, formLabelStyle, inputStyle,
} from "./styles";

export function SchoolFormModal({
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
  const [fellows, setFellows] = useState<FellowOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const invalidate = useInvalidate();

  useEffect(() => {
    let cancelled = false;
    getFellows()
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
              <FellowPicker
                fellows={fellows}
                value={fellowId}
                onChange={setFellowId}
                fallbackName={school?.fellow_name ?? null}
              />
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
  fellows, value, onChange, fallbackName,
}: {
  fellows: FellowOption[];
  value: string;
  onChange: (id: string) => void;
  fallbackName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = fellows.find((f) => f.id === value) ?? null;
  const hasAssignment = Boolean(value && (selected || fallbackName));

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
            placeholder={
              selected
                ? `Search… (current: ${selected.name})`
                : (value && fallbackName)
                  ? `Search… (current: ${fallbackName})`
                  : "Search fellows…"
            }
            style={{ flex: 1, padding: "12px 16px", border: "none", background: "transparent", outline: "none", fontFamily: "var(--font-body)", fontSize: "14px", color: "#034852" }}
          />
        ) : (
          <span style={{ flex: 1, color: hasAssignment ? "#034852" : "rgba(3,72,82,0.5)" }}>
            {selected
              ? `${selected.name}${selected.email ? ` (${selected.email})` : ""}`
              : (value && fallbackName)
                ? `${fallbackName} (list unavailable)`
                : "— Unassigned —"}
          </span>
        )}
        {hasAssignment && !open && (
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
