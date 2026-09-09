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
  const [alignRight, setAlignRight] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setAlignRight(rect.left + 260 > window.innerWidth);
    }

    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
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
        onClick={() => {
          if (!disabled) {
            setOpen((v) => {
              if (!v) setQuery("");
              return !v;
            });
          }
        }}
        style={{
          width: "100%",
          padding: "8px 14px",
          borderRadius: "12px",
          border: open ? "1px solid #209379" : "1px solid rgba(3,72,82,0.2)",
          boxShadow: open ? "0 0 0 1px #209379" : "none",
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
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel || placeholder}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "rgba(3,72,82,0.4)",
            display: "inline-block",
            transition: "transform 0.15s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: alignRight ? "auto" : 0,
            right: alignRight ? 0 : "auto",
            minWidth: "max(100%, 220px)",
            maxWidth: "min(360px, calc(100vw - 32px))",
            width: "max-content",
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
              width: "100%",
              padding: "10px 14px",
              border: "none",
              borderBottom: "1px solid rgba(3,72,82,0.08)",
              fontSize: "13px",
              color: "#034852",
              outline: "none",
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
          <div
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              maxHeight: "230px",
            }}
          >
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
              className="hover:bg-[rgba(3,72,82,0.04)] transition-colors"
              style={{
                display: "block",
                width: "100%",
                padding: "8px 14px",
                background: value === "" ? "rgba(10,190,98,0.08)" : undefined,
                border: "none",
                textAlign: "left",
                fontSize: "13px",
                color: value === "" ? "#034852" : "rgba(3,72,82,0.6)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                boxSizing: "border-box",
                fontWeight: value === "" ? 600 : 400,
              }}
              title={placeholder}
            >
              {placeholder}
            </button>
            {filtered.map((o) => {
              const isSelected = value === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
                  className="hover:bg-[rgba(3,72,82,0.04)] transition-colors"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 14px",
                    background: isSelected ? "rgba(10,190,98,0.12)" : undefined,
                    border: "none",
                    textAlign: "left",
                    fontSize: "13px",
                    color: "#034852",
                    cursor: "pointer",
                    fontWeight: isSelected ? 600 : 400,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    boxSizing: "border-box",
                  }}
                  title={o.label}
                >
                  {o.label}
                </button>
              );
            })}
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

