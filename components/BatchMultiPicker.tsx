"use client";

import { useMemo, useState } from "react";
import { useBatches } from "@/lib/queries/batches";

/**
 * Multi-select for ACTIVE batches, used by comms create forms (announcements,
 * live classes, resources). Emits batch ids; empty selection = unrestricted
 * (batch_ids omitted → everyone targeted by the other filters sees it).
 */
export function BatchMultiPicker({
  value,
  onChange,
  inputStyle,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  inputStyle?: React.CSSProperties;
}) {
  const { data: batches = [], isLoading } = useBatches("ACTIVE");
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => batches.filter((b) => value.includes(b.id)),
    [batches, value],
  );

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    const list = q
      ? batches.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.school_name ?? "").toLowerCase().includes(q),
        )
      : batches;
    return list.slice(0, 50);
  }, [batches, q]);

  function toggle(id: string) {
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
          {selected.map((b) => (
            <span
              key={b.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px 3px 10px", borderRadius: "100px",
                background: "rgba(10,190,98,0.1)", border: "1px solid rgba(10,190,98,0.25)",
                fontSize: "12px", fontWeight: 600, color: "#034852",
              }}
            >
              {b.name}
              <button
                type="button"
                onClick={() => toggle(b.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)", fontSize: "14px", lineHeight: 1, padding: "0 2px", fontWeight: 700 }}
                aria-label={`Remove ${b.name}`}
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
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search batches… (leave empty to target everyone)"
        style={{ ...baseInput, marginBottom: "6px" }}
      />

      <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.1)", borderRadius: "10px" }}>
        {isLoading ? (
          <p style={{ padding: "12px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>Loading batches…</p>
        ) : matches.length === 0 ? (
          <p style={{ padding: "12px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>
            {q ? "No matching batches." : "No active batches."}
          </p>
        ) : matches.map((b) => {
          const checked = value.includes(b.id);
          return (
            <label
              key={b.id}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 12px", cursor: "pointer",
                borderBottom: "1px solid rgba(3,72,82,0.05)",
                background: checked ? "rgba(10,190,98,0.07)" : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(b.id)}
                style={{ accentColor: "#0abe62", width: "14px", height: "14px", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#034852" }}>{b.name}</span>
                <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                  {b.school_name ?? "Independent"} · {b.member_count} student{b.member_count !== 1 ? "s" : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
