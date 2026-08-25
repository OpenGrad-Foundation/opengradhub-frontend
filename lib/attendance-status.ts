/**
 * One vocabulary for attendance status, shared by every surface that renders it.
 *
 * These labels and colours were duplicated across the Records grid, the class
 * roster, the Live Classes list and the student view. Four copies meant four
 * chances to drift — and they had already drifted on the one word that matters
 * most: UNKNOWN is "Not recorded", never "Absent". A gap in the record is
 * missing evidence, not a statement about the student.
 *
 * The foregrounds are chosen to clear WCAG AA (4.5:1) against BOTH white and
 * their own chip tint, measured rather than eyeballed:
 *
 *   PRESENT #067a3f  4.85:1 on tint · 5.44:1 on white
 *   ABSENT  #c62828  4.91:1 on tint · 5.62:1 on white
 *   UNKNOWN #4a6b70  5.13:1 on tint · 5.79:1 on white
 *
 * The previous values (#0abe62 at 2.45:1, rgba(229,62,62,.8) at 3.21:1 and
 * rgba(3,72,82,.35) at 1.93:1) all failed, and the worst of them was the one
 * carrying "present".
 */
import type { AttendanceStatus } from "./attendance-api";

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  UNKNOWN: "Not recorded",
};

/**
 * Compact marks for the Records matrix. A glyph alone never carries the
 * meaning — every cell pairs it with the label for assistive tech, and the grid
 * shows a legend, because "–" reads as "absent" to anyone who has not been told
 * otherwise.
 */
export const STATUS_GLYPH: Record<AttendanceStatus, string> = {
  PRESENT: "✓",
  ABSENT: "✗",
  UNKNOWN: "–",
};

export const STATUS_FG: Record<AttendanceStatus, string> = {
  PRESENT: "#067a3f",
  ABSENT: "#c62828",
  UNKNOWN: "#4a6b70",
};

export const STATUS_BG: Record<AttendanceStatus, string> = {
  PRESENT: "rgba(10,190,98,0.12)",
  ABSENT: "rgba(229,62,62,0.10)",
  UNKNOWN: "rgba(3,72,82,0.07)",
};

export const STATUS_ORDER: AttendanceStatus[] = ["PRESENT", "ABSENT", "UNKNOWN"];

export function chipStyle(s: AttendanceStatus): React.CSSProperties {
  return { background: STATUS_BG[s], color: STATUS_FG[s] };
}

/**
 * Secondary text that still has to be readable. The app-wide
 * `--color-text-muted` / `--color-text-subtle` tokens sit at 3.92:1 and 2.40:1,
 * so attendance states its own value rather than shipping unreadable metadata.
 * Fixing those tokens would move every screen in the product and belongs in its
 * own change.
 */
export const MUTED = "#4a6b70";
