"use client";

import { useMemo, useState } from "react";
import { putLiveClassAttendance, type AttendanceRosterRow } from "@/lib/api-attendance";
import { useLiveClassRoster } from "@/lib/queries/live-classes";
import { useInvalidate } from "@/lib/mutations/invalidation";

export function AttendanceSheet({ liveClassId, title, canMark, onClose }: {
  liveClassId: string;
  title: string;
  canMark: boolean;
  onClose: () => void;
}) {
  const { data: roster = [], isPending, error } = useLiveClassRoster(liveClassId);
  const invalidate = useInvalidate();
  const [overrides, setOverrides] = useState<Record<string, "PRESENT" | "ABSENT">>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const effective = (r: AttendanceRosterRow) => overrides[r.student_id] ?? r.status;
  const dirty = useMemo(
    () => roster.filter((r) => overrides[r.student_id] && overrides[r.student_id] !== r.status),
    [roster, overrides],
  );

  function toggle(r: AttendanceRosterRow) {
    if (!canMark || saving) return;
    const next = effective(r) === "PRESENT" ? "ABSENT" : "PRESENT";
    setOverrides((o) => ({ ...o, [r.student_id]: next }));
  }

  async function save() {
    if (saving || dirty.length === 0) return; // double-submit guard
    setSaving(true);
    setSaveError(null);
    try {
      await putLiveClassAttendance(
        liveClassId,
        dirty.map((r) => ({ student_id: r.student_id, status: overrides[r.student_id] })),
      );
      invalidate("liveClassAttendance");
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = roster.filter((r) => effective(r) === "PRESENT").length;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <p style={S.label}>Attendance</p>
            <h2 style={{ ...S.heading, fontSize: "18px", margin: "4px 0 0" }}>{title}</h2>
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "4px 0 0" }}>
              {presentCount}/{roster.length} present{canMark ? " · tap a row to toggle" : " · view only"}
            </p>
          </div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {isPending ? (
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>Loading roster…</p>
        ) : error ? (
          <p style={{ color: "#e53e3e", fontSize: "14px" }}>{(error as Error).message}</p>
        ) : roster.length === 0 ? (
          <p style={{ fontSize: "14px", color: "rgba(3,72,82,0.6)" }}>No students in your scope for this class.</p>
        ) : (
          <div style={{ maxHeight: "50vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {roster.map((r) => {
              const st = effective(r);
              return (
                <button key={r.student_id} onClick={() => toggle(r)} disabled={!canMark || saving}
                  style={{ ...S.row, cursor: canMark ? "pointer" : "default" }}>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852" }}>{r.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "rgba(3,72,82,0.55)" }}>
                      {r.school_name ?? "—"}
                      {r.source === "AUTO" && r.joined_at ? " · joined via link" : ""}
                      {r.source === "MANUAL" && r.marked_by_name ? ` · marked by ${r.marked_by_name}` : ""}
                    </p>
                  </div>
                  <span style={{ ...S.chip, ...(st === "PRESENT" ? S.chipPresent : S.chipAbsent) }}>
                    {st === "PRESENT" ? "Present" : "Absent"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {saveError && <p style={{ color: "#e53e3e", fontSize: "13px", marginTop: "10px" }}>{saveError}</p>}

        {canMark && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button onClick={onClose} style={S.secondaryBtn}>Cancel</button>
            <button onClick={() => void save()} disabled={saving || dirty.length === 0}
              style={{ ...S.primaryBtn, opacity: saving || dirty.length === 0 ? 0.6 : 1 }}>
              {saving ? "Saving…" : `Save${dirty.length ? ` (${dirty.length})` : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(3,72,82,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "16px" } as React.CSSProperties,
  modal: { background: "#fff", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "560px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" } as React.CSSProperties,
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "#209379", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  closeBtn: { background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "rgba(3,72,82,0.5)", padding: "4px" } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "12px", background: "#fff", fontFamily: "inherit" } as React.CSSProperties,
  chip: { flexShrink: 0, padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 } as React.CSSProperties,
  chipPresent: { background: "rgba(10,190,98,0.12)", color: "#0abe62" } as React.CSSProperties,
  chipAbsent: { background: "rgba(229,62,62,0.1)", color: "#e53e3e" } as React.CSSProperties,
  primaryBtn: { padding: "10px 20px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px", cursor: "pointer" } as React.CSSProperties,
  secondaryBtn: { padding: "10px 20px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.2)", background: "transparent", color: "#034852", fontWeight: 600, fontSize: "13px", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
};
