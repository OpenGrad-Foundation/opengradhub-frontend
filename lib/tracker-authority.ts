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
 * One Save, several requests. Own rows keep the ordinary route because the server refuses a
 * self-override outright ("is your own — fill it normally"), and foreign rows are grouped by
 * doer in first-seen order because the override batch takes one person at a time.
 */
export function groupEditsByAuthority(
  edits: TrackerBatchEdit[],
  rowsById: Map<string, TrackerGridRow>,
): AuthorityGroups {
  const own: TrackerBatchEdit[] = [];
  const groups = new Map<string, { doerId: string; doerName: string | null; edits: TrackerBatchEdit[] }>();
  let skipped = 0;
  for (const edit of edits) {
    const row = rowsById.get(edit.record_id);
    const auth = row ? rowAuthority(row) : null;
    if (!row || !auth?.known) { skipped += 1; continue; }
    if (auth.self) { own.push(edit); continue; }
    if (!auth.override || !row.doer_id) { skipped += 1; continue; }
    const group = groups.get(row.doer_id)
      ?? { doerId: row.doer_id, doerName: row.doer_name ?? null, edits: [] };
    group.edits.push(edit);
    groups.set(row.doer_id, group);
  }
  return { own, byDoer: [...groups.values()], skipped };
}
