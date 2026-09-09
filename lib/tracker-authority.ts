import type { TrackerBatchEdit, TrackerGridRow } from "@/lib/tracker-api";

export type RowAuthority = {
  /** Fill it the ordinary way — the viewer is its doer (or an admin). */
  self: boolean;
  /** Fill it in the doer's name, through the override batch. */
  override: boolean;
  /** Strict doer authority: photo/geo proofs and the bulk-CSV round trip. */
  evidence: boolean;
  /** Like `evidence`, but a SUPER_ADMIN may also raise a blocker. */
  blocker: boolean;
  /**
   * False when the payload predates per-row capabilities. The grid then renders the row
   * read-only and refetches. There is deliberately no fallback: inferring write authority
   * from the route is the defect this replaces — a manager's grid would offer controls on
   * rows the server refuses, which is exactly the "out of scope" dead end.
   */
  known: boolean;
};

const CLOSED: RowAuthority = { self: false, override: false, evidence: false, blocker: false, known: false };

export function rowAuthority(row: TrackerGridRow): RowAuthority {
  if (row.can_fill_self === undefined || row.can_fill_override === undefined) return CLOSED;
  return {
    self: row.can_fill_self === true,
    override: row.can_fill_override === true,
    evidence: row.can_evidence === true,
    blocker: row.can_blocker === true,
    known: true,
  };
}

export type AuthorityGroups = {
  /** Rows the viewer owns. These take the ordinary batch even mid-override-session. */
  own: TrackerBatchEdit[];
  /** One group per doer: the override route accepts a single doer per request. */
  byDoer: Array<{ doerId: string; doerName: string | null; edits: TrackerBatchEdit[] }>;
  /** Edits no route can carry — stale rows, unknown authority, or a row with no doer. */
  skipped: number;
};

/**
 * One Save, several requests. Foreign rows are grouped by doer in first-seen order because
 * the override batch takes one person at a time.
 *
 * `inSession` decides the route for a row that offers BOTH — a SUPER_ADMIN may fill anyone's
 * row ordinarily as well as override it. Inside an on-behalf session the override route is
 * the one the manager asked for and the one the UI promised: it carries the reason, writes
 * the audit event, notifies the doer, and waives the gates the session says it waives.
 * Outside a session the ordinary route applies. The server never sets `can_fill_override` on
 * the caller's own row, so this can never turn an own row into a self-override (a 400).
 */
export function groupEditsByAuthority(
  edits: TrackerBatchEdit[],
  rowsById: Map<string, TrackerGridRow>,
  inSession = false,
): AuthorityGroups {
  const own: TrackerBatchEdit[] = [];
  const groups = new Map<string, { doerId: string; doerName: string | null; edits: TrackerBatchEdit[] }>();
  let skipped = 0;
  for (const edit of edits) {
    const row = rowsById.get(edit.record_id);
    const auth = row ? rowAuthority(row) : null;
    if (!row || !auth?.known) { skipped += 1; continue; }
    const overriding = inSession && auth.override && Boolean(row.doer_id);
    if (auth.self && !overriding) { own.push(edit); continue; }
    if (!overriding) { skipped += 1; continue; }
    const doerId = row.doer_id as string;
    const group = groups.get(doerId) ?? { doerId, doerName: row.doer_name ?? null, edits: [] };
    group.edits.push(edit);
    groups.set(doerId, group);
  }
  return { own, byDoer: [...groups.values()], skipped };
}
