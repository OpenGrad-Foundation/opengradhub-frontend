"use client";

import { useMemo, useState } from "react";
import type { SchoolOption } from "@/lib/api";

/**
 * Multi-select school combobox — chips for the current selection, search over the
 * fields the rows actually display (name, code, district, state), click to toggle.
 *
 * Unlike BatchMultiPicker this does NOT fetch: the caller passes `schools`, so it
 * can hand over the full list and mark the unavailable ones via `disabledIds`
 * instead of pre-filtering them out. Pre-filtering would silently drop a chip from
 * `value` if another user linked that school between renders.
 */
export function SchoolMultiPicker({
  schools,
  value,
  onChange,
  disabledIds,
  isLoading = false,
  placeholder = "Search schools by name, code or district…",
  disabled = false,
  inputStyle,
}: {
  schools: SchoolOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabledIds?: string[];
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  inputStyle?: React.CSSProperties;
}) {
  const [query, setQuery] = useState("");

  const blocked = useMemo(() => new Set(disabledIds ?? []), [disabledIds]);

  const selected = useMemo(
    () => schools.filter((s) => value.includes(s.id)),
    [schools, value],
  );

  const q = query.trim().toLowerCase();
  const { matches, totalMatches } = useMemo(() => {
    const list = q
      ? schools.filter((s) =>
          [s.name, s.code, s.district, s.state]
            .some((f) => (f ?? "").toLowerCase().includes(q)),
        )
      : schools;
    return { matches: list.slice(0, 50), totalMatches: list.length };
  }, [schools, q]);

  function toggle(id: string) {
    if (blocked.has(id)) return;
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const baseInput: React.CSSProperties = inputStyle ?? {
    width: "100%", padding: "11px 14px",
    background: "rgba(3,72,82,0.03)", border: "1px solid rgba(3,72,82,0.12)",
    borderRadius: "10px", color: "#034852", fontSize: "14px",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selected.map((s) => (
            <span
              key={s.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px 3px 10px", borderRadius: "100px",
                background: "rgba(10,190,98,0.1)", border: "1px solid rgba(10,190,98,0.25)",
                fontSize: "12px", fontWeight: 600, color: "#034852",
              }}
            >
              {s.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== s.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)", fontSize: "14px", lineHeight: 1, padding: "0 2px", fontWeight: 700 }}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={{ ...baseInput, marginBottom: "6px" }}
      />

      <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "10px" }}>
        {isLoading ? (
          <p style={{ padding: "12px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>
            Loading schools…
          </p>
        ) : matches.length === 0 ? (
          <p style={{ padding: "12px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>
            {q ? "No matching schools." : "No schools available."}
          </p>
        ) : matches.map((s) => {
          const checked = value.includes(s.id);
          const isBlocked = blocked.has(s.id);
          return (
            <label
              key={s.id}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 12px", cursor: isBlocked ? "not-allowed" : "pointer",
                borderBottom: "1px solid rgba(3,72,82,0.05)",
                background: checked ? "rgba(10,190,98,0.07)" : "transparent",
                opacity: isBlocked ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || isBlocked}
                onChange={() => toggle(s.id)}
                style={{ accentColor: "#0abe62", width: "14px", height: "14px", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#034852" }}>{s.name}</span>
                <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                  {[s.code, s.district, s.state].filter(Boolean).join(" · ") || "—"}
                  {isBlocked ? " · already added" : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {totalMatches > matches.length && (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
          Showing first {matches.length} of {totalMatches} — keep typing to narrow.
        </p>
      )}
    </div>
  );
}
