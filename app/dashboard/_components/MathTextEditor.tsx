"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  splitMathSegments,
  spliceMathSegment,
  insertEquation,
  type MathSegment,
} from "@/lib/math-segments";

// MathLive's <math-field> web component — minimal surface we use.
type MathfieldEl = HTMLElement & { value: string; focus: () => void };

/* eslint-disable @typescript-eslint/no-namespace -- JSX typing for the <math-field> custom element requires namespace augmentation */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

type MathSeg = Extract<MathSegment, { kind: "math" }>;

// ── KaTeX-rendered clickable equation ──────────────────────────

function KatexSpan({ latex, display, onClick }: { latex: string; display: boolean; onClick: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("katex").then(mod => {
      const katex = mod.default ?? mod;
      if (!cancelled && ref.current) {
        katex.render(latex, ref.current, { throwOnError: false, displayMode: display });
      }
    });
    return () => { cancelled = true; };
  }, [latex, display]);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      title="Click to edit equation"
      onClick={onClick}
      onKeyDown={e => { if (e.key === "Enter") onClick(); }}
      style={{
        cursor: "pointer", padding: "0 3px", borderRadius: "4px",
        background: "rgba(10,190,98,0.1)", outlineColor: "#0abe62",
      }}
    />
  );
}

// ── MathLive equation panel ────────────────────────────────────

function EquationPanel({
  initialLatex,
  onSave,
  onCancel,
}: {
  initialLatex: string;
  onSave: (latex: string) => void;
  onCancel: () => void;
}) {
  const mfRef = useRef<MathfieldEl | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [fallback, setFallback] = useState(initialLatex);

  useEffect(() => {
    let cancelled = false;
    import("mathlive")
      .then(({ MathfieldElement }) => {
        if (cancelled) return;
        MathfieldElement.soundsDirectory = null;
        MathfieldElement.fontsDirectory = "/mathlive-fonts";
        setStatus("ready");
      })
      .catch(() => { if (!cancelled) setStatus("failed"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status === "ready" && mfRef.current) {
      mfRef.current.value = initialLatex;
      mfRef.current.focus();
    }
  }, [status, initialLatex]);

  function handleSave() {
    onSave(status === "failed" ? fallback : (mfRef.current?.value ?? ""));
  }

  return (
    <div style={{
      marginTop: "6px", padding: "10px",
      border: "1px solid rgba(10,190,98,0.4)", borderRadius: "10px",
      background: "rgba(10,190,98,0.04)",
    }}>
      {status === "loading" && (
        <p style={{ margin: 0, fontSize: "12px", color: "rgba(3,72,82,0.5)" }}>Loading equation editor…</p>
      )}
      {status === "ready" && (
        <math-field
          ref={(el: HTMLElement | null) => { mfRef.current = el as MathfieldEl | null; }}
          style={{ display: "block", width: "100%", fontSize: "18px", borderRadius: "8px" }}
        />
      )}
      {status === "failed" && (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#e53e3e" }}>
            Equation editor failed to load — enter LaTeX directly:
          </p>
          <input
            value={fallback}
            onChange={e => setFallback(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(3,72,82,0.2)", boxSizing: "border-box" }}
            placeholder="e.g. \frac{1}{2}"
          />
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ padding: "5px 12px", borderRadius: "8px", border: "1px solid rgba(3,72,82,0.2)", background: "#fff", fontSize: "12px", fontWeight: 600, color: "#034852", cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "loading"}
          style={{ padding: "5px 14px", borderRadius: "8px", border: "none", background: "#0abe62", fontSize: "12px", fontWeight: 700, color: "#fff", cursor: "pointer", opacity: status === "loading" ? 0.5 : 1 }}
        >
          Save equation
        </button>
      </div>
    </div>
  );
}

// ── Main editor ────────────────────────────────────────────────

/**
 * Hybrid math text editor: plain text edits in the textarea; equations are
 * created/edited visually in a MathLive panel and stored as `$latex$` in the
 * value. A live KaTeX preview appears whenever the value contains math —
 * click an equation in the preview to edit it in place.
 */
export function MathTextEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
  compact?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cursorRef = useRef<number>(0);
  // null = closed; { seg: null } = inserting new equation
  const [panel, setPanel] = useState<{ latex: string; seg: MathSeg | null } | null>(null);

  const segments = splitMathSegments(value);
  const hasMath = segments.some(s => s.kind === "math");

  function openInsert() {
    cursorRef.current = taRef.current?.selectionStart ?? value.length;
    setPanel({ latex: "", seg: null });
  }

  function handleSave(latex: string) {
    if (panel?.seg) {
      onChange(spliceMathSegment(value, panel.seg, latex));
    } else if (latex.trim()) {
      onChange(insertEquation(value, cursorRef.current, latex));
    }
    setPanel(null);
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <button
          type="button"
          onClick={openInsert}
          style={{
            padding: compact ? "2px 8px" : "4px 10px",
            border: "1px solid rgba(10,190,98,0.5)", borderRadius: "6px",
            background: "rgba(10,190,98,0.08)", color: "#067a44",
            fontSize: compact ? "11px" : "12px", fontWeight: 700, cursor: "pointer",
          }}
        >
          ƒx Equation
        </button>
        {hint && <span style={{ fontSize: "10px", color: "rgba(3,72,82,0.45)" }}>{hint}</span>}
      </div>

      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={{
          width: "100%", padding: compact ? "8px 12px" : "10px 14px",
          background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: "10px", color: "#034852",
          fontFamily: "var(--font-body)", fontSize: compact ? "13px" : "14px",
          outline: "none", boxSizing: "border-box",
          resize: rows > 1 ? "vertical" : "none", lineHeight: 1.6,
        }}
      />

      {hasMath && (
        <div
          data-testid="math-preview"
          style={{
            marginTop: "4px", padding: compact ? "6px 12px" : "8px 14px",
            background: "rgba(3,72,82,0.025)", border: "1px dashed rgba(3,72,82,0.15)",
            borderRadius: "10px", fontSize: compact ? "13px" : "14px",
            color: "#034852", lineHeight: 1.7,
          }}
        >
          {segments.map((seg, i) =>
            seg.kind === "text" ? (
              <span
                key={`${i}-${seg.value}`}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(seg.value, { USE_PROFILES: { html: true } }) }}
              />
            ) : (
              <KatexSpan
                key={`${i}-${seg.latex}`}
                latex={seg.latex}
                display={seg.display}
                onClick={() => setPanel({ latex: seg.latex, seg })}
              />
            ),
          )}
        </div>
      )}

      {panel && (
        <EquationPanel
          initialLatex={panel.latex}
          onSave={handleSave}
          onCancel={() => setPanel(null)}
        />
      )}
    </div>
  );
}
