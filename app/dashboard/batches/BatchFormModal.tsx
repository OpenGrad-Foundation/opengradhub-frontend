"use client";

import { type Batch } from "@/lib/api";
import { useBatchForm, primaryButton, secondaryButton } from "./BatchForm";

/**
 * Create / edit slide-over for a batch. `defaultSchoolId` pre-fills the host
 * school on create (used by the school detail page's "+ Add Batch" shortcut).
 *
 * The fields themselves live in `BatchForm` so the batch detail page's Settings
 * tab renders the same editor inline.
 */
export function BatchFormModal({
  mode, batch, defaultSchoolId, onClose, onSaved,
}: {
  mode: "create" | "edit";
  batch?: Batch;
  defaultSchoolId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { fields, save, saving } = useBatchForm({ mode, batch, defaultSchoolId, autoFocusName: true, onSaved });

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add Batch" : "Edit Batch"}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
          boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "batchPanelIn 240ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <style>{`@keyframes batchPanelIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={labelStyle}>{mode === "create" ? "Add Batch" : "Edit Batch"}</p>
            {mode === "edit" && batch && (
              <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 2px" }}>{batch.name}</h2>
            )}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {fields}
        </div>

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

const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379" };
const titleStyle: React.CSSProperties = { fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 700, color: "#034852" };
const closeBtnStyle: React.CSSProperties = { background: "none", border: "none", fontSize: "18px", color: "rgba(3,72,82,0.5)", cursor: "pointer", padding: "4px 8px", borderRadius: "8px" };
