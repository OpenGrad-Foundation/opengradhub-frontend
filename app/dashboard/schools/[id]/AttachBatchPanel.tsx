"use client";

import { useCallback, useEffect, useState } from "react";
import { getBatches, updateBatch, type Batch } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { BatchFormModal } from "../../batches/BatchFormModal";
import {
  labelStyle, titleStyle, secondaryButton, closeBtnStyle, inputStyle, linkBtnStyle,
} from "../styles";

/**
 * Slide-over to attach an EXISTING batch to this school. Candidates are ACTIVE
 * batches not already hosted here (independent ones first, then batches hosted
 * at another school — attaching moves them). Attach = PATCH /batches/:id
 * { school_id } (guard batches.edit — opener gated on it).
 *
 * When the batch does not exist yet, "Create a new batch" stacks the batch
 * create slide-over on top with this school pre-filled, so the user never
 * leaves the school screen to go make one. Closing it drops back here with the
 * list refreshed; the new batch is already hosted here, so it lands in the
 * school's accordion rather than in the candidate list.
 */
export function AttachBatchPanel({
  schoolId, schoolName, onClose, onChanged,
}: {
  schoolId: string;
  schoolName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [attachedIds, setAttachedIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const invalidate = useInvalidate();
  const { has } = usePermissions();
  const canCreateBatch = has(PERM.batches.create);

  const loadBatches = useCallback(() => {
    setLoading(true);
    return getBatches("ACTIVE")
      .then((rows) => setBatches(rows))
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load batches."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void loadBatches(); }, [loadBatches]);

  const q = query.trim().toLowerCase();
  const candidates = batches
    .filter((b) => b.school_id !== schoolId && !attachedIds.has(b.id))
    .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.school_name ?? "").toLowerCase().includes(q))
    // Independent (no host) first, then batches hosted elsewhere.
    .sort((a, b) => Number(!!a.school_name) - Number(!!b.school_name) || a.name.localeCompare(b.name));

  async function attach(batch: Batch) {
    setAttachingId(batch.id);
    setErr(null);
    try {
      await updateBatch(batch.id, { school_id: schoolId });
      invalidate("batches", "schools");
      setAttachedIds((prev) => new Set(prev).add(batch.id));
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to attach batch.");
    } finally {
      setAttachingId(null);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(3,72,82,0.18)", backdropFilter: "blur(3px)", zIndex: 40 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Attach batch to school"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)",
          background: "#ffffff", borderLeft: "1px solid rgba(3,72,82,0.1)",
          boxShadow: "-24px 0 64px rgba(3,72,82,0.12)", zIndex: 41,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={labelStyle}>Add Batch</p>
            <h2 style={{ ...titleStyle, fontSize: "20px", margin: "4px 0 2px" }}>{schoolName}</h2>
          </div>
          <button onClick={onClose} style={closeBtnStyle} aria-label="Close panel">✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search batches by name…"
              aria-label="Search batches"
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            {canCreateBatch && (
              <button
                onClick={() => setShowCreate(true)}
                style={{ ...secondaryButton, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                + New batch
              </button>
            )}
          </div>
          {err && <p style={{ color: "#c53030", fontWeight: 600, fontSize: "13px", margin: "10px 0 0" }}>{err}</p>}

          <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
            {loading ? (
              <p style={hintStyle}>Loading batches…</p>
            ) : candidates.length === 0 ? (
              <div style={{ display: "grid", gap: "8px", justifyItems: "start" }}>
                <p style={hintStyle}>
                  {q ? "No batch matches that search." : "No existing batch is available to add."}
                </p>
                {canCreateBatch && (
                  <button onClick={() => setShowCreate(true)} style={secondaryButton}>
                    Create a new batch for {schoolName}
                  </button>
                )}
              </div>
            ) : candidates.map((b) => (
              <div
                key={b.id}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "12px", border: "1px solid rgba(3,72,82,0.08)" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "#034852" }}>
                    {b.name}{b.programme_type ? ` · ${b.programme_type}` : ""}
                  </p>
                  <p style={{ margin: 0, fontSize: "12px", color: b.school_name ? "#b7791f" : "rgba(3,72,82,0.55)" }}>
                    {b.school_name ? `Currently at ${b.school_name} — will be moved` : "Independent"}
                    {` · ${b.member_count} student${b.member_count === 1 ? "" : "s"}`}
                  </p>
                </div>
                <button
                  onClick={() => void attach(b)}
                  disabled={attachingId === b.id}
                  style={{ ...linkBtnStyle, opacity: attachingId === b.id ? 0.5 : 1 }}
                >
                  {attachingId === b.id ? "Adding…" : "Add"}
                </button>
              </div>
            ))}
            {(attachedIds.size > 0 || createdCount > 0) && (
              <p style={{ ...hintStyle, color: "#209379", fontWeight: 600 }}>
                {[
                  attachedIds.size > 0 && `${attachedIds.size} batch${attachedIds.size === 1 ? "" : "es"} added`,
                  createdCount > 0 && `${createdCount} batch${createdCount === 1 ? "" : "es"} created here`,
                ].filter(Boolean).join(" · ")}.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 28px 24px", borderTop: "1px solid rgba(3,72,82,0.08)", flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={secondaryButton}>Done</button>
        </div>
      </div>

      {/* Stacked on top of this panel — same slide-over the Batches page uses,
          with the host school pre-filled. Saving returns here, not to /batches. */}
      {showCreate && (
        <BatchFormModal
          mode="create"
          defaultSchoolId={schoolId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            setCreatedCount((n) => n + 1);
            invalidate("batches", "schools");
            void loadBatches();
            onChanged();
          }}
        />
      )}
    </>
  );
}

const hintStyle: React.CSSProperties = { margin: 0, fontSize: "13px", color: "rgba(3,72,82,0.55)" };
