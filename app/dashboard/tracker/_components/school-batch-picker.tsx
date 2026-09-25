"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type PickerSchool = { id: string; name: string };
export type PickerBatch = { id: string; name: string; schoolId: string | null; memberCount: number };
export type SchoolBatchPick = { schoolIds: string[]; batchIds: string[] };

/**
 * Schools, each with its batches underneath, for the task builder.
 *
 * The pick is a union the server honours as such: a ticked school covers all of its
 * students, a ticked batch its members. A school shows ✓ when it is taken whole (or every
 * one of its batches is ticked) and – when only some are. Ticking a batch under a whole
 * school turns the school into "the other batches"; ticking every batch stays a batch pick —
 * it never silently widens to the whole school, whose students need not all be in a batch.
 * Batches with no school (a camp that gathers students from many schools) are listed alone.
 */
export function SchoolBatchPicker({
  schools, batches, showBatches, value, onChange,
}: {
  schools: PickerSchool[];
  batches: PickerBatch[];
  /** Batches only narrow student tasks; a school task picks schools alone. */
  showBatches: boolean;
  value: SchoolBatchPick;
  onChange: (next: SchoolBatchPick) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const known = useMemo(() => new Set(schools.map((s) => s.id)), [schools]);
  const bySchool = useMemo(() => {
    const m = new Map<string, PickerBatch[]>();
    for (const b of batches) if (b.schoolId && known.has(b.schoolId)) m.set(b.schoolId, [...(m.get(b.schoolId) ?? []), b]);
    return m;
  }, [batches, known]);
  const loose = showBatches ? batches.filter((b) => !b.schoolId || !known.has(b.schoolId)) : [];

  const whole = new Set(value.schoolIds);
  const picked = new Set(value.batchIds);
  const needle = q.trim().toLowerCase();
  const hit = (s: string) => !needle || s.toLowerCase().includes(needle);
  const batchesOf = (id: string) => (showBatches ? bySchool.get(id) ?? [] : []);
  const shownSchools = schools.filter((s) => hit(s.name) || batchesOf(s.id).some((b) => hit(b.name)));
  const shownLoose = loose.filter((b) => hit(b.name));

  const emit = (schoolIds: Set<string>, batchIds: Set<string>) =>
    onChange({ schoolIds: [...schoolIds], batchIds: [...batchIds] });

  const allBatchesPicked = (id: string) => { const m = batchesOf(id); return m.length > 0 && m.every((x) => picked.has(x.id)); };
  function toggleSchool(id: string) {
    const s = new Set(whole); const b = new Set(picked);
    const mine = batchesOf(id).map((x) => x.id);
    const on = s.has(id) || allBatchesPicked(id);
    if (on) s.delete(id); else s.add(id);
    mine.forEach((x) => b.delete(x)); // whole school or nothing: either way no per-batch picks
    emit(s, b);
  }
  function toggleBatch(batch: PickerBatch) {
    const s = new Set(whole); const b = new Set(picked);
    const sid = batch.schoolId && known.has(batch.schoolId) ? batch.schoolId : null;
    if (!sid) { if (b.has(batch.id)) b.delete(batch.id); else b.add(batch.id); emit(s, b); return; }
    const mine = batchesOf(sid).map((x) => x.id);
    if (s.has(sid)) { // whole → all but this one
      s.delete(sid);
      mine.filter((x) => x !== batch.id).forEach((x) => b.add(x));
    } else if (b.has(batch.id)) b.delete(batch.id);
    else b.add(batch.id);
    emit(s, b);
  }
  const allShownPicked = shownSchools.length > 0 && shownSchools.every((s) => whole.has(s.id) || allBatchesPicked(s.id));
  function toggleAllShown() {
    const s = new Set(whole); const b = new Set(picked);
    for (const sc of shownSchools) {
      batchesOf(sc.id).forEach((x) => b.delete(x.id));
      if (allShownPicked) s.delete(sc.id); else s.add(sc.id);
    }
    emit(s, b);
  }
  const toggleOpen = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const summary = !value.schoolIds.length && !value.batchIds.length ? "all"
    : [value.schoolIds.length && `${value.schoolIds.length} school${value.schoolIds.length === 1 ? "" : "s"}`,
       value.batchIds.length && `${value.batchIds.length} batch${value.batchIds.length === 1 ? "" : "es"}`].filter(Boolean).join(", ");

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm font-medium text-gray-700">
        {showBatches ? "Schools & batches" : "Schools"} <span className="font-normal text-gray-500">({summary})</span>
      </legend>
      <p className="text-xs text-gray-500">
        {showBatches
          ? "Tick a school for all its students, or open it to pick batches. Leave empty for everyone you reach."
          : "Leave empty for every school you reach."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={showBatches ? "Search schools or batches" : "Search schools"}
          aria-label="Search schools and batches"
          className="h-8 min-w-0 flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none focus:border-teal-500" />
        {shownSchools.length > 0 && (
          <button type="button" onClick={toggleAllShown} aria-pressed={allShownPicked}
            className={"rounded-md border px-2.5 py-1 text-xs font-medium " + (allShownPicked ? "border-teal-600 bg-teal-600 text-white" : "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100")}>
            {allShownPicked ? "Deselect" : "Select"} all {shownSchools.length} schools
          </button>
        )}
        {(value.schoolIds.length > 0 || value.batchIds.length > 0) && (
          <button type="button" onClick={() => emit(new Set(), new Set())} className="text-xs font-medium text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>
      <div className="flex max-h-64 flex-col gap-0.5 overflow-auto rounded-md border border-gray-100 p-1">
        {shownLoose.length > 0 && (
          <div className="mb-1 border-b border-gray-100 pb-1">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Batches across schools</p>
            {shownLoose.map((b) => (
              <label key={b.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={picked.has(b.id)} onChange={() => toggleBatch(b)} />
                <span className="text-gray-900">{b.name}</span>
                <span className="text-xs text-gray-400">{b.memberCount} students</span>
              </label>
            ))}
          </div>
        )}
        {shownSchools.length === 0 && shownLoose.length === 0 && <p className="px-2 py-1 text-xs text-gray-400">Nothing matches.</p>}
        {shownSchools.map((s) => {
          const mine = batchesOf(s.id);
          const nPicked = mine.filter((b) => picked.has(b.id)).length;
          const full = whole.has(s.id) || allBatchesPicked(s.id);
          const partial = !full && nPicked > 0;
          const isOpen = open.has(s.id) || (needle !== "" && !hit(s.name));
          return (
            <div key={s.id}>
              <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  aria-label={s.name}
                  checked={full}
                  ref={(el) => { if (el) el.indeterminate = partial; }}
                  onChange={() => toggleSchool(s.id)}
                />
                <span className="flex-1 text-gray-900">{s.name}</span>
                {mine.length > 0 && (
                  <button type="button" onClick={() => toggleOpen(s.id)} aria-expanded={isOpen}
                    className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-white">
                    {isOpen ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                    {full ? `${mine.length}/${mine.length}` : `${nPicked}/${mine.length}`} batch{mine.length === 1 ? "" : "es"}
                  </button>
                )}
              </div>
              {isOpen && mine.length > 0 && (
                <div className="ml-7 flex flex-col gap-0.5 border-l border-gray-100 pl-2">
                  {mine.filter((b) => !needle || hit(s.name) || hit(b.name)).map((b) => (
                    <label key={b.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                      <input type="checkbox" checked={whole.has(s.id) || picked.has(b.id)} onChange={() => toggleBatch(b)} />
                      <span className="text-gray-800">{b.name}</span>
                      <span className="text-xs text-gray-400">{b.memberCount} students</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
