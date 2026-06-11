"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SchoolOption } from "@/lib/api";

/**
 * Searchable school combobox that resolves a typed name/code to a school id (UUID).
 *
 * Unlike the old state→district cascade selects, this is NOT gated by geo — every
 * school is reachable, including ones with missing/blank state or district. The
 * value emitted is always `schools.id` (the UUID the backend expects), so callers
 * never type or paste a raw id/code.
 */
export function SchoolSearchPicker({
  schools,
  value,
  onChange,
  placeholder = "Search school by name or code…",
  disabled = false,
  inputStyle,
}: {
  schools: SchoolOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const label = (s: SchoolOption) =>
    `${s.name}${s.code ? ` · ${s.code}` : ""}${s.district ? ` · ${s.district}` : ""}`;

  const selected = useMemo(
    () => schools.find((s) => s.id === value) ?? null,
    [schools, value],
  );

  // When not actively typing, show the selected school's label in the box.
  const display = open ? query : selected ? label(selected) : "";

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? schools
      : schools.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.code ?? "").toLowerCase().includes(q),
        );
    return list.slice(0, 50);
  }, [schools, query]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(s: SchoolOption) {
    onChange(s.id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={display}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        style={inputStyle ?? defaultInput}
      />
      {value && !open && (
        <button
          type="button"
          aria-label="Clear school"
          onClick={() => { onChange(""); setQuery(""); }}
          style={clearBtn}
        >
          ✕
        </button>
      )}
      {open && (
        <div style={dropdown}>
          {matches.length === 0 ? (
            <div style={{ ...row, color: "rgba(3,72,82,0.5)", cursor: "default" }}>
              No schools found
            </div>
          ) : (
            matches.map((s) => (
              <div
                key={s.id}
                onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                style={{ ...row, background: s.id === value ? "rgba(3,72,82,0.06)" : "transparent" }}
              >
                <span style={{ fontWeight: 600, color: "#034852" }}>{s.name}</span>
                <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.55)" }}>
                  {[s.code, s.district, s.state].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const defaultInput: React.CSSProperties = {
  width: "100%", padding: "12px 16px", background: "rgba(0,0,0,0.04)",
  border: "1px solid rgba(0,0,0,0.12)", borderRadius: "12px", color: "#034852",
  fontFamily: "var(--font-body)", fontSize: "14px", outline: "none", boxSizing: "border-box",
};
const clearBtn: React.CSSProperties = {
  position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", fontSize: "12px",
  color: "rgba(3,72,82,0.45)", padding: "4px",
};
const dropdown: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
  maxHeight: "260px", overflowY: "auto", background: "#ffffff",
  border: "1px solid rgba(3,72,82,0.14)", borderRadius: "12px",
  boxShadow: "0 12px 32px rgba(3,72,82,0.16)",
};
const row: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: "2px",
  padding: "9px 14px", cursor: "pointer", borderBottom: "1px solid rgba(3,72,82,0.05)",
};
