import { describe, it, expect } from 'vitest';
import { rowAuthority, groupEditsByAuthority } from '@/lib/tracker-authority';
import type { TrackerGridRow } from '@/lib/tracker-api';

const base = {
  record_id: 'r1', status: 'not_started', cells: [], blocked: false, blocker: null,
  school_name: null, target_name: null, lifecycle: 'not_started',
} as unknown as TrackerGridRow;

const row = (patch: Partial<TrackerGridRow>) => ({ ...base, ...patch }) as TrackerGridRow;

describe('rowAuthority', () => {
  it('fails closed when the payload predates per-row capabilities', () => {
    expect(rowAuthority(row({}))).toEqual({
      self: false, override: false, evidence: false, blocker: false, known: false,
    });
  });

  it('reads the capabilities verbatim when the server sent them', () => {
    expect(rowAuthority(row({
      can_fill_self: false, can_fill_override: true, can_evidence: false, can_blocker: false,
      doer_id: 'd1',
    }))).toEqual({ self: false, override: true, evidence: false, blocker: false, known: true });
  });

  it('treats an admin row as fillable but not as evidence-owning', () => {
    expect(rowAuthority(row({
      can_fill_self: true, can_fill_override: false, can_evidence: false, can_blocker: true,
      doer_id: 'someone-else',
    }))).toEqual({ self: true, override: false, evidence: false, blocker: true, known: true });
  });
});

describe('groupEditsByAuthority', () => {
  const own = row({ record_id: 'own', can_fill_self: true, can_fill_override: false, doer_id: 'me' });
  const a1 = row({ record_id: 'a1', can_fill_self: false, can_fill_override: true, doer_id: 'A', doer_name: 'Asha' });
  const a2 = row({ ...a1, record_id: 'a2' });
  const b1 = row({ ...a1, record_id: 'b1', doer_id: 'B', doer_name: 'Bala' });
  const orphan = row({ record_id: 'orphan', can_fill_self: false, can_fill_override: true, doer_id: null });
  const unknown = row({ record_id: 'unknown' });
  const rows = new Map([own, a1, a2, b1, orphan, unknown].map((r) => [r.record_id, r]));

  it('sends own rows ordinarily and groups the rest one doer at a time', () => {
    const edits = ['own', 'a1', 'a2', 'b1'].map((record_id) => ({ record_id, values: {}, status: 'done' }));
    const out = groupEditsByAuthority(edits, rows);
    expect(out.own.map((e) => e.record_id)).toEqual(['own']);
    expect(out.byDoer.map((g) => [g.doerId, g.edits.length])).toEqual([['A', 2], ['B', 1]]);
    expect(out.byDoer[0].doerName).toBe('Asha');
    expect(out.skipped).toBe(0);
  });

  it('submits nothing the server would refuse: no doer, unknown authority, or a stale row', () => {
    const edits = ['orphan', 'unknown', 'ghost'].map((record_id) => ({ record_id, values: {}, status: 'done' }));
    const out = groupEditsByAuthority(edits, rows);
    expect(out.own).toEqual([]);
    expect(out.byDoer).toEqual([]);
    expect(out.skipped).toBe(3);
  });

  it('keeps an own row on the ordinary route even inside an override session', () => {
    const out = groupEditsByAuthority(
      [{ record_id: 'a1', values: {}, status: 'done' }, { record_id: 'own', values: {}, status: 'done' }],
      rows,
    );
    // The server rejects a self-override with 400 "is your own — fill it normally".
    expect(out.own.map((e) => e.record_id)).toEqual(['own']);
    expect(out.byDoer).toHaveLength(1);
  });
});
