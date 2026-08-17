"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MultiPickOption = { id: string; label: string; sublabel?: string };

/** Menu height bounds: tall enough to scroll usefully, short enough to fit. */
const MAX_MENU_HEIGHT = 280;
const MIN_MENU_HEIGHT = 140;
/** Rows rendered per query. Beyond this the footer asks for a narrower search. */
const MAX_ROWS = 200;

/**
 * Generic searchable multi-select — chips for the current selection, a search
 * box, and a checkbox list. Sibling of SchoolMultiPicker, but option-shaped
 * rather than school-shaped so the programme surfaces (members, courses,
 * assignments) can share one control.
 *
 * Two search modes:
 *  - client (default): the component filters `options` over label + sublabel.
 *  - server (`onQueryChange` set): the parent narrows `options` per query —
 *    the component only reports what was typed and renders what it is given.
 *
 * Selections survive narrowing in either mode: every option ever seen is
 * cached by id, so a chip picked under one query keeps its label after the
 * next query drops it from `options`.
 *
 * The list is a floating dropdown: closed until the search box is focused,
 * closed again on an outside click, and overlaid on the page rather than
 * pushing the layout down. Chips stay visible either way, so a collapsed
 * picker still shows what is selected.
 *
 * It renders through a PORTAL, anchored to the input's viewport rect. An
 * absolutely-positioned menu is clipped by any ancestor with `overflow:
 * hidden` — which the cards these pickers sit in all have, for their rounded
 * corners — so the menu appeared as a sliver inside the card. Portalling to
 * document.body escapes both the clip and any ancestor stacking context.
 */
export function SearchMultiPicker({
  options,
  value,
  onChange,
  onQueryChange,
  isLoading = false,
  placeholder = "Search…",
  emptyText = "Nothing available.",
  disabled = false,
}: {
  options: MultiPickOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  onQueryChange?: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rect, setRect] = useState<
    { top: number; left: number; width: number; maxHeight: number } | null
  >(null);

  // Position the menu AND decide how tall it may be. A fixed-position menu
  // anchored below an input near the bottom of the viewport would render
  // off-screen and be unreachable — the page scrolls, the menu follows. So:
  // clamp the height to the room actually available, and open upwards when
  // there is more room above. The list scrolls inside whatever height it gets.
  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 4;
    const MARGIN = 12;
    const below = window.innerHeight - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const flip = below < MIN_MENU_HEIGHT && above > below;
    const room = Math.max(MIN_MENU_HEIGHT, flip ? above : below);
    const maxHeight = Math.min(MAX_MENU_HEIGHT, room);
    const next = {
      top: flip ? Math.max(MARGIN, r.top - GAP - maxHeight) : r.bottom + GAP,
      left: r.left,
      width: r.width,
      maxHeight,
    };
    // Scrolling INSIDE the menu also fires the capture-phase listener, and the
    // input has not moved — bail rather than re-render on every wheel tick.
    setRect((prev) =>
      prev &&
      prev.top === next.top &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.maxHeight === next.maxHeight
        ? prev
        : next,
    );
  }, []);

  // The menu is portalled, so it must follow the input through scrolls and
  // resizes rather than inheriting its position from the DOM.
  useEffect(() => {
    if (!open) return;
    measure();
    const onMove = () => measure();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, measure]);

  // Collapse on outside click. The menu lives outside the root now, so both
  // subtrees count as "inside" — otherwise ticking a checkbox would close it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Every option ever seen, so a chip picked under one server query keeps its
  // label after the next query drops it from `options`. Fed by an effect —
  // the render that narrows `options` reads what the previous render stored.
  const [seen, setSeen] = useState<Map<string, MultiPickOption>>(() => new Map());
  useEffect(() => {
    setSeen((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const o of options) {
        const cur = next.get(o.id);
        if (!cur || cur.label !== o.label || cur.sublabel !== o.sublabel) {
          next.set(o.id, o);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [options]);

  const selected = value.map(
    (id) => options.find((o) => o.id === id) ?? seen.get(id) ?? { id, label: id },
  );

  const q = query.trim().toLowerCase();
  const { matches, totalMatches } = useMemo(() => {
    const list =
      onQueryChange || !q
        ? options
        : options.filter((o) =>
            [o.label, o.sublabel].some((f) => (f ?? "").toLowerCase().includes(q)),
          );
    return { matches: list.slice(0, MAX_ROWS), totalMatches: list.length };
  }, [options, q, onQueryChange]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  const baseInput: React.CSSProperties = {
    width: "100%", padding: "11px 14px",
    background: "rgba(3,72,82,0.03)", border: "1px solid rgba(3,72,82,0.12)",
    borderRadius: "10px", color: "#034852", fontSize: "14px",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
          {selected.map((o) => (
            <span
              key={o.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: "4px",
                padding: "3px 8px 3px 10px", borderRadius: "100px",
                background: "rgba(10,190,98,0.1)", border: "1px solid rgba(10,190,98,0.25)",
                fontSize: "12px", fontWeight: 600, color: "#034852",
              }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== o.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(3,72,82,0.4)", fontSize: "14px", lineHeight: 1, padding: "0 2px", fontWeight: 700 }}
                aria-label={`Remove ${o.label}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="search"
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          onQueryChange?.(e.target.value);
        }}
        placeholder={placeholder}
        style={baseInput}
      />

      {open && typeof document !== "undefined" && createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          top: rect?.top ?? 0, left: rect?.left ?? 0, width: rect?.width ?? "auto",
          zIndex: 1000,
          maxHeight: rect?.maxHeight ?? MAX_MENU_HEIGHT,
          overflowY: "auto", overscrollBehavior: "contain",
          background: "#fff", border: "1px solid rgba(3,72,82,0.12)", borderRadius: "10px",
          boxShadow: "0 12px 28px rgba(3,72,82,0.18)",
        }}
      >
        {isLoading ? (
          <p style={{ padding: "12px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>
            Loading…
          </p>
        ) : matches.length === 0 ? (
          <p style={{ padding: "12px", margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.5)" }}>
            {q ? "No matches." : emptyText}
          </p>
        ) : matches.map((o) => {
          const checked = value.includes(o.id);
          return (
            <label
              key={o.id}
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
                disabled={disabled}
                onChange={() => toggle(o.id)}
                style={{ accentColor: "#0abe62", width: "14px", height: "14px", flexShrink: 0 }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#034852" }}>{o.label}</span>
                {o.sublabel && (
                  <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>{o.sublabel}</span>
                )}
              </span>
            </label>
          );
        })}
        {!isLoading && totalMatches > matches.length && (
          <p style={{ margin: 0, padding: "8px 12px", fontSize: "11px", color: "rgba(3,72,82,0.5)", borderTop: "1px solid rgba(3,72,82,0.06)" }}>
            Showing first {matches.length} of {totalMatches} — keep typing to narrow.
          </p>
        )}
      </div>,
        document.body,
      )}
    </div>
  );
}
