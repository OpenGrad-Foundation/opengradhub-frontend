"use client";

import { useState, useRef, useEffect } from "react";

type Option = { value: string; label: string };

export function SearchableSelect({
  value, onChange, options, placeholder, disabled, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  /** Field name for screen readers; the current choice is appended. */
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [alignRight, setAlignRight] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  // The placeholder row clears the choice, so it is the first item.
  const items: Option[] = [{ value: "", label: placeholder }, ...filtered];

  useEffect(() => {
    (listRef.current?.children[active] as HTMLElement | undefined)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function openList() {
    setQuery("");
    setActive(Math.max(0, [{ value: "" }, ...options].findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[active]) pick(items[active].value); }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", minWidth: "160px" }}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel ? `${ariaLabel}: ${selectedLabel || placeholder}` : undefined}
        onClick={() => {
          if (disabled) return;
          if (open) { setOpen(false); setQuery(""); } else openList();
        }}
        onKeyDown={(e) => {
          if (!open && !disabled && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); openList(); }
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
            onChange={(e) => { setQuery(e.target.value); setActive(e.target.value ? 1 : 0); }}
            onKeyDown={onSearchKey}
            placeholder="Search…"
            aria-label={`Search ${(ariaLabel ?? placeholder.replace(/^All /, "")).toLowerCase()}`}
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
            ref={listRef}
            style={{
              overflowY: "auto",
              overflowX: "hidden",
              maxHeight: "230px",
            }}
          >
            {items.map((o, i) => {
              const isSelected = value === o.value;
              const isPlaceholder = o.value === "";
              return (
                <button
                  key={o.value || "__placeholder"}
                  type="button"
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className="hover:bg-[rgba(3,72,82,0.04)] transition-colors"
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 14px",
                    background: isSelected
                      ? (isPlaceholder ? "rgba(10,190,98,0.08)" : "rgba(10,190,98,0.12)")
                      : i === active ? "rgba(3,72,82,0.06)" : undefined,
                    border: "none",
                    textAlign: "left",
                    fontSize: "13px",
                    color: isPlaceholder && !isSelected ? "rgba(3,72,82,0.6)" : "#034852",
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
