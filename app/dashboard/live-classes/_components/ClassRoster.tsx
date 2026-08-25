"use client";

/**
 * THE roster view for a live class — one component where there used to be two
 * (an attendee modal that showed joined/missed, and a sheet that marked
 * attendance). Both were renderings of the same grain, and keeping them apart
 * meant two answers to one question.
 *
 * What it shows depends on the class, not on who opened it:
 *   ONLINE       — join + fellow corrections, markable by a fellow or an admin
 *   SCHOOL_BASED — the committed register for the class's day, read-only
 *   (unset)      — a legacy class nothing could resolve; says so plainly
 */
import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { useClassRoster, useMarkClassAttendance } from "@/lib/queries/attendance";
import type { AttendanceStatus, RosterRow } from "@/lib/attendance-api";
import { STATUS_LABEL as LABEL, chipStyle, MUTED } from "@/lib/attendance-status";

type Filter = "ALL" | "PRESENT" | "ABSENT" | "UNKNOWN";

/** How this student's status was arrived at, in words a fellow would use. */
function provenance(r: RosterRow): string {
  if (r.source === "MANUAL" && r.marked_by_name) return `marked by ${r.marked_by_name}`;
  if (r.source === "JOIN" && r.joined_at) return "joined the class";
  if (r.source === "REGISTER") return "from the school register";
  return "";
}

export function ClassRoster({ liveClassId, onClose }: {
  liveClassId: string;
  onClose: () => void;
}) {
  const { data, isPending, error } = useClassRoster(liveClassId);
  const mark = useMarkClassAttendance();
  const [overrides, setOverrides] = useState<Record<string, "PRESENT" | "ABSENT">>({});
  const [filter, setFilter] = useState<Filter>("ALL");
  const [saveError, setSaveError] = useState<string | null>(null);

  // A fresh [] each render would re-run the memo below every time.
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const canMark = data?.can_mark ?? false;

  const effective = (r: RosterRow): AttendanceStatus => overrides[r.student_id] ?? r.status;
  const dirty = useMemo(
    () => rows.filter((r) => overrides[r.student_id] && overrides[r.student_id] !== r.status),
    [rows, overrides],
  );

  const present = rows.filter((r) => effective(r) === "PRESENT").length;
  const marked = rows.filter((r) => effective(r) !== "UNKNOWN").length;

  const isDirty = (r: RosterRow) =>
    overrides[r.student_id] !== undefined && overrides[r.student_id] !== r.status;
  // A row that no longer matches the filter BECAUSE you just changed it stays
  // put. Letting it disappear mid-correction hid the mistake before the user
  // could see it, and took the only undo with it.
  const shown = rows.filter((r) => filter === "ALL" || effective(r) === filter || isDirty(r));
  const hasUnknown = rows.some((r) => effective(r) === "UNKNOWN");

  /**
   * Tapping cycles through the states this row can reach and ALWAYS comes back
   * to the value the server holds. The old version flipped PRESENT<->ABSENT, so
   * a row that arrived UNKNOWN could be marked but never un-marked: one mis-tap
   * was unrecoverable without discarding the whole session.
   *
   * From UNKNOWN:  Not recorded -> Present -> Absent -> Not recorded
   * From a mark:   Present <-> Absent, the second tap restoring the original.
   */
  function cycle(r: RosterRow) {
    if (!canMark || mark.isPending) return;
    const cur = effective(r);
    setOverrides((o) => {
      const next = { ...o };
      if (r.status === "UNKNOWN") {
        if (cur === "UNKNOWN") next[r.student_id] = "PRESENT";
        else if (cur === "PRESENT") next[r.student_id] = "ABSENT";
        else delete next[r.student_id];
      } else if (cur === r.status) {
        next[r.student_id] = r.status === "PRESENT" ? "ABSENT" : "PRESENT";
      } else {
        delete next[r.student_id];
      }
      return next;
    });
  }

  // Backdrop click and Escape both route through onClose, so the guard belongs
  // here rather than on the buttons: a staged marking session is real work and
  // one stray click off the panel should not silently discard it.
  function requestClose() {
    if (dirty.length > 0 && !window.confirm(
      `Discard ${dirty.length} unsaved mark${dirty.length === 1 ? "" : "s"}?`,
    )) return;
    onClose();
  }

  async function save() {
    if (mark.isPending || dirty.length === 0) return; // double-submit guard
    setSaveError(null);
    try {
      await mark.mutateAsync({
        liveClassId,
        marks: dirty.map((r) => ({ student_id: r.student_id, status: overrides[r.student_id] })),
      });
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save attendance.");
    }
  }

  const sourceLine =
    data?.class.attendance_mode === "ONLINE"
      ? canMark
        ? "Marked by joining the class · tap a row to correct it"
        : "Marked by joining the class"
      : data?.note ?? "";

  return (
    <Modal
      onClose={requestClose}
      title={
        <>
          <p style={S.label}>Attendance</p>
          <h2 style={{ ...S.heading, fontSize: "18px", margin: "4px 0 0" }}>{data?.class.title ?? "…"}</h2>
          <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.6)", margin: "4px 0 0" }}>
            {/* Denominator is what was actually RECORDED. Falling back to the
                roster size turned "nothing recorded" into "everyone absent" —
                and an empty `rows` while the fetch is still in flight is not
                evidence of anything, so it gets no verdict at all. */}
            {isPending
              ? "Loading…"
              : error
                ? "Couldn't load this roster"
                : marked === 0
                  ? `Nothing recorded yet · ${rows.length} student${rows.length === 1 ? "" : "s"}`
                  : `${present}/${marked} present`}
          </p>
          {sourceLine && (
            <p style={{ fontSize: "12px", color: "rgba(3,72,82,0.55)", margin: "4px 0 0" }}>{sourceLine}</p>
          )}
        </>
      }
    >
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
            {(["ALL", "PRESENT", "ABSENT", ...(hasUnknown ? (["UNKNOWN"] as const) : [])] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ ...S.filterBtn, ...(filter === f ? S.filterOn : {}) }}>
                {f === "ALL" ? "All" : LABEL[f as AttendanceStatus]}
              </button>
            ))}
          </div>
        )}

        {isPending ? (
          <p style={S.muted}>Loading roster…</p>
        ) : error ? (
          <p style={{ color: "#c62828", fontSize: "14px" }}>{(error as Error).message}</p>
        ) : rows.length === 0 ? (
          <p style={S.muted}>No students in your scope for this class.</p>
        ) : (
          <div style={{ maxHeight: "50vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {shown.map((r) => {
              const st = effective(r);
              const why = provenance(r);
              const changed = isDirty(r);
              const body = (
                <>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#034852" }}>{r.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: MUTED }}>
                      {r.school_name ?? "—"}{why ? ` · ${why}` : ""}
                    </p>
                  </div>
                  {/* Says what it WAS as well as what it now is, so a change is
                      reviewable before Save rather than only afterwards. */}
                  {changed && (
                    <span style={S.wasChip}>
                      was {LABEL[r.status].toLowerCase()}
                    </span>
                  )}
                  <span style={{ ...S.chip, ...chipStyle(st) }}>{LABEL[st]}</span>
                </>
              );

              // Read-only rosters render as plain rows. A disabled <button> is
              // dropped from the tab order and announces itself as unavailable,
              // which is the wrong thing to say about content that is simply
              // not editable here.
              return canMark ? (
                <button
                  key={r.student_id}
                  onClick={() => cycle(r)}
                  disabled={mark.isPending}
                  aria-label={`${r.name} — ${LABEL[st]}. Change.`}
                  data-roster-row
                  style={{ ...S.row, cursor: "pointer" }}
                >
                  {body}
                </button>
              ) : (
                <div key={r.student_id} data-roster-row style={S.row}>{body}</div>
              );
            })}
          </div>
        )}

        {saveError && <p role="alert" style={{ color: "#c62828", fontSize: "13px", marginTop: "10px" }}>{saveError}</p>}

        {canMark && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button onClick={requestClose} style={S.secondaryBtn}>Cancel</button>
            <button
              onClick={() => void save()}
              disabled={mark.isPending || dirty.length === 0}
              style={{ ...S.primaryBtn, opacity: mark.isPending || dirty.length === 0 ? 0.6 : 1 }}
            >
              {mark.isPending ? "Saving…" : `Save${dirty.length ? ` (${dirty.length})` : ""}`}
            </button>
          </div>
        )}
    </Modal>
  );
}

const S = {
  label: { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em", color: "var(--teal)", margin: 0 } as React.CSSProperties,
  heading: { fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852" } as React.CSSProperties,
  muted: { fontSize: "14px", color: MUTED } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", minHeight: "56px", border: "1px solid rgba(3,72,82,0.08)", borderRadius: "12px", background: "#fff", fontFamily: "inherit", width: "100%", boxSizing: "border-box" } as React.CSSProperties,
  chip: { flexShrink: 0, padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 700 } as React.CSSProperties,
  wasChip: { flexShrink: 0, padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 600, color: MUTED, border: "1px dashed rgba(3,72,82,0.25)" } as React.CSSProperties,
  // 44px minimum on every control: these are tapped by fellows on phones, and
  // the old 26px chips and 24px card buttons were below every platform floor.
  filterBtn: { minHeight: "44px", padding: "8px 16px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.15)", background: "transparent", fontSize: "13px", fontWeight: 600, color: "#034852", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
  filterOn: { border: "none", background: "linear-gradient(135deg, #067a3f 0%, #005b5a 100%)", color: "#fff" } as React.CSSProperties,
  primaryBtn: { minHeight: "44px", padding: "12px 22px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #067a3f 0%, #005b5a 100%)", color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "14px", cursor: "pointer" } as React.CSSProperties,
  secondaryBtn: { minHeight: "44px", padding: "12px 22px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.2)", background: "transparent", color: "#034852", fontWeight: 600, fontSize: "14px", cursor: "pointer", fontFamily: "var(--font-body)" } as React.CSSProperties,
};
