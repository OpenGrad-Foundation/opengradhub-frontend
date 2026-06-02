"use client";

import { useState, useRef, useEffect } from "react";

type Option = { value: string; label: string };

export function SearchableSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={wrapRef} style={{ position: "relative", minWidth: "160px" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "8px 14px",
          borderRadius: "12px",
          border: "1px solid rgba(3,72,82,0.2)",
          background: disabled ? "rgba(3,72,82,0.05)" : "#fff",
          color: disabled ? "rgba(3,72,82,0.4)" : "#034852",
          fontSize: "13px",
          fontWeight: 600,
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel || placeholder}
        </span>
        <span style={{ fontSize: "10px", color: "rgba(3,72,82,0.4)" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: "280px",
            overflow: "hidden",
            background: "#fff",
            border: "1px solid rgba(3,72,82,0.15)",
            borderRadius: "12px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            style={{
              padding: "10px 14px",
              border: "none",
              borderBottom: "1px solid rgba(3,72,82,0.08)",
              fontSize: "13px",
              color: "#034852",
              outline: "none",
            }}
          />
          <div style={{ overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 14px",
                background: value === "" ? "rgba(10,190,98,0.08)" : "transparent",
                border: "none",
                textAlign: "left",
                fontSize: "13px",
                color: "rgba(3,72,82,0.6)",
                cursor: "pointer",
              }}
            >
              {placeholder}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 14px",
                  background: value === o.value ? "rgba(10,190,98,0.12)" : "transparent",
                  border: "none",
                  textAlign: "left",
                  fontSize: "13px",
                  color: "#034852",
                  cursor: "pointer",
                  fontWeight: value === o.value ? 600 : 400,
                }}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: "12px 14px", fontSize: "12px", color: "rgba(3,72,82,0.45)" }}>
                No matches.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
