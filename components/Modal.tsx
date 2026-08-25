"use client";

import { useEffect, useId, useRef } from "react";

/**
 * A dialog that behaves like one.
 *
 * Both attendance dialogs were hand-rolled divs with `role="dialog"` and nothing
 * else: no accessible name, no Escape, no initial focus, and nothing stopping
 * Tab from walking into the page behind the overlay. A sighted mouse user never
 * notices; a keyboard or screen-reader user cannot use the screen at all.
 *
 * Deliberately small — focus containment, a name, Escape, and restoring focus
 * to whatever opened it. Anything more belongs in a real dialog library.
 */
export function Modal({ title, onClose, children, maxWidth = "560px" }: {
  /** Rendered as the dialog's heading AND its accessible name. */
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Focus the panel itself rather than its first control: a screen reader then
    // announces the dialog and its name before anything inside it.
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) {
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(3,72,82,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "20px", padding: "24px",
          width: "100%", maxWidth, outline: "none",
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
          <div id={titleId} style={{ minWidth: 0 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "rgba(3,72,82,0.5)", padding: "4px" }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
