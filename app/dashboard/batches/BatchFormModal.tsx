"use client";

import { X } from "lucide-react";
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
        style={{ position: "fixed", inset: 0, background: "rgb(3 20 30 / 35%)", zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Add Batch" : "Edit Batch"}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "var(--color-surface)", borderLeft: "1px solid var(--color-border)",
          zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "batchPanelIn 240ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <style>{`@keyframes batchPanelIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ ...titleStyle, margin: 0 }}>{mode === "create" ? "Add Batch" : "Edit Batch"}</h2>
            {mode === "edit" && batch && (
              <p style={{ fontSize: "14px", color: "var(--color-text-muted)", margin: "4px 0 0" }}>{batch.name}</p>
            )}
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel"><X size={20} aria-hidden="true" /></button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          {fields}
        </div>

        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid var(--color-border)", flexShrink: 0, display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={secondaryButton}>Cancel</button>
          <button onClick={() => void save()} disabled={saving} style={{ ...primaryButton, opacity: saving ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

const titleStyle: React.CSSProperties = { fontSize: "18px", fontWeight: 600, color: "var(--color-text)" };
const closeBtnStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: "44px", minHeight: "44px", background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", borderRadius: "8px" };
