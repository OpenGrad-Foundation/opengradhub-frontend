"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

export type PickerSchool = { id: string; name: string };
export type PickerBatch = { id: string; name: string; schoolId: string | null; memberCount: number };
export type SchoolBatchPick = { schoolIds: string[]; batchIds: string[] };

/**
 * Schools, then batches, for the task builder. Each school with batches has a toggle beside
 * its name that opens them in place; the Batches list below shows the same batches (plus
 * those with no school), narrowed to the ticked schools. Both views edit one pick.
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
  const [bq, setBq] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Batches list: a cascade — the section opens, then each school group opens. Both start
  // closed; searching opens the groups that match. "Group by school" off = one flat list.
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [grouped, setGrouped] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const known = useMemo(() => new Set(schools.map((s) => s.id)), [schools]);
  const schoolName = useMemo(() => new Map(schools.map((s) => [s.id, s.name])), [schools]);
  const bySchool = useMemo(() => {
    const m = new Map<string, PickerBatch[]>();
    for (const b of batches) if (b.schoolId && known.has(b.schoolId)) m.set(b.schoolId, [...(m.get(b.schoolId) ?? []), b]);
    return m;
  }, [batches, known]);
  const isLoose = (b: PickerBatch) => !b.schoolId || !known.has(b.schoolId);

  const whole = new Set(value.schoolIds);
  const picked = new Set(value.batchIds);
  const has = (text: string, needle: string) => !needle || text.toLowerCase().includes(needle);
  const batchesOf = (id: string) => (showBatches ? bySchool.get(id) ?? [] : []);
  const shownSchools = schools.filter((s) => has(s.name, q.trim().toLowerCase()));

  const emit = (schoolIds: Set<string>, batchIds: Set<string>) =>
    onChange({ schoolIds: [...schoolIds], batchIds: [...batchIds] });

  const allBatchesPicked = (id: string) => { const m = batchesOf(id); return m.length > 0 && m.every((x) => picked.has(x.id)); };
  const batchChecked = (b: PickerBatch) => picked.has(b.id) || (!isLoose(b) && whole.has(b.schoolId as string));
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
    const sid = isLoose(batch) ? null : (batch.schoolId as string);
    if (sid && s.has(sid)) { // whole school → every other batch of it
      s.delete(sid);
      batchesOf(sid).filter((x) => x.id !== batch.id).forEach((x) => b.add(x.id));
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

  // Batches list: narrowed by the schools ticked in the Schools list above — never by batch
  // picks, or ticking one school's batches here would hide every other school's. School-less
  // batches always stay, since they cut across schools.
  const touched = whole;
  const shownBatches = batches
    .filter((b) => isLoose(b) || touched.size === 0 || touched.has(b.schoolId as string))
    .filter((b) => has(`${b.name} ${schoolName.get(b.schoolId ?? "") ?? ""}`, bq.trim().toLowerCase()));
  const allBatchesShownPicked = shownBatches.length > 0 && shownBatches.every(batchChecked);
  /** Tick or untick a set of batches as batch picks (a whole school they belong to is split). */
  function setBatches(list: PickerBatch[], on: boolean) {
    const s = new Set(whole); const b = new Set(picked);
    for (const x of list) {
      const sid = isLoose(x) ? null : (x.schoolId as string);
      if (on) { if (!batchChecked(x)) b.add(x.id); continue; }
      b.delete(x.id);
      if (sid && s.has(sid)) { // untick part of a whole school → keep its other batches
        s.delete(sid);
        batchesOf(sid).filter((y) => !list.some((z) => z.id === y.id)).forEach((y) => b.add(y.id));
      }
    }
    emit(s, b);
  }
  const LOOSE = "__across";
  const groups = (() => {
    const m = new Map<string, PickerBatch[]>();
    for (const b of shownBatches) { const k = isLoose(b) ? LOOSE : (b.schoolId as string); m.set(k, [...(m.get(k) ?? []), b]); }
    return [...m.entries()].sort(([a], [b]) => (a === LOOSE ? -1 : b === LOOSE ? 1
      : (schoolName.get(a) ?? "").localeCompare(schoolName.get(b) ?? "")));
  })();
  const toggleExpanded = (k: string) => setExpanded((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  function toggleAllBatches() {
    const s = new Set(whole); const b = new Set(picked);
    for (const x of shownBatches) {
      if (allBatchesShownPicked) {
        b.delete(x.id);
        if (!isLoose(x) && s.has(x.schoolId as string)) s.delete(x.schoolId as string);
      } else if (!batchChecked(x)) b.add(x.id);
    }
    emit(s, b);
  }

  const summary = !value.schoolIds.length && !value.batchIds.length ? "all"
    : [value.schoolIds.length && `${value.schoolIds.length} school${value.schoolIds.length === 1 ? "" : "s"}`,
       value.batchIds.length && `${value.batchIds.length} batch${value.batchIds.length === 1 ? "" : "es"}`].filter(Boolean).join(", ");
  const toggleBtn = (on: boolean) =>
    "rounded-md border px-2.5 py-1 text-xs font-medium " + (on ? "border-teal-600 bg-teal-600 text-white" : "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100");
  const searchCls = "h-8 min-w-0 flex-1 rounded-md border border-gray-300 px-2 text-sm outline-none focus:border-teal-500";

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-gray-700">
          Schools <span className="font-normal text-gray-500">({summary})</span>
        </legend>
        <p className="text-xs text-gray-500">
          {showBatches
            ? "Tick a school for all its students, or open ▾ beside it to pick some of its batches. Leave empty for everyone you reach."
            : "Leave empty for every school you reach."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search schools" aria-label="Search schools" className={searchCls} />
          {shownSchools.length > 0 && (
            <button type="button" onClick={toggleAllShown} aria-pressed={allShownPicked} className={toggleBtn(allShownPicked)}>
              {allShownPicked ? "Deselect" : "Select"} all {shownSchools.length} schools
            </button>
          )}
          {(value.schoolIds.length > 0 || value.batchIds.length > 0) && (
            <button type="button" onClick={() => emit(new Set(), new Set())} className="text-xs font-medium text-gray-500 hover:text-gray-800">Clear</button>
          )}
        </div>
        {shownSchools.length === 0 ? (
          <p className="px-2 py-1 text-xs text-gray-400">{schools.length ? "No school matches." : "None available."}</p>
        ) : (
          <div className="grid max-h-60 items-start gap-1 overflow-auto sm:grid-cols-2">
            {shownSchools.map((s) => {
              const mine = batchesOf(s.id);
              const nPicked = mine.filter((b) => picked.has(b.id)).length;
              const full = whole.has(s.id) || allBatchesPicked(s.id);
              const partial = !full && nPicked > 0;
              const isOpen = open.has(s.id);
              return (
                <div key={s.id}>
                  <div className="flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                    <label className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={s.name}
                        checked={full}
                        ref={(el) => { if (el) el.indeterminate = partial; }}
                        onChange={() => toggleSchool(s.id)}
                      />
                      <span className="truncate text-gray-900">{s.name}</span>
                    </label>
                    {mine.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleOpen(s.id)}
                        aria-expanded={isOpen}
                        aria-label={`Batches of ${s.name}`}
                        title={isOpen ? "Hide batches" : "Show batches"}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                      >
                        <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isOpen ? "rotate-180" : "")} aria-hidden="true" />
                        {full ? `${mine.length}/${mine.length}` : nPicked ? `${nPicked}/${mine.length}` : mine.length}
                      </button>
                    )}
                  </div>
                  {isOpen && mine.length > 0 && (
                    <div className="ml-7 flex flex-col gap-0.5 border-l border-gray-100 pl-2">
                      {mine.map((b) => (
                        <label key={b.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                          <input type="checkbox" aria-label={b.name} checked={batchChecked(b)} onChange={() => toggleBatch(b)} />
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
        )}
      </fieldset>

      {showBatches && (
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Batches</legend>
          <button
            type="button"
            onClick={() => setBatchesOpen((o) => !o)}
            aria-expanded={batchesOpen}
            className="flex items-center gap-1.5 self-start rounded text-sm font-medium text-gray-700 hover:text-gray-950"
          >
            <ChevronDown className={"h-4 w-4 transition-transform " + (batchesOpen ? "" : "-rotate-90")} aria-hidden="true" />
            Batches <span className="font-normal text-gray-500">({value.batchIds.length ? `${value.batchIds.length} selected` : "all"})</span>
          </button>
          <p className="text-xs text-gray-500">
            {touched.size ? "Batches of the schools above, plus batches that span schools." : "Every batch you reach. Tick schools above to narrow this list."}
          </p>
          {batchesOpen && (<>
          <div className="flex flex-wrap items-center gap-2">
            <input value={bq} onChange={(e) => setBq(e.target.value)} placeholder="Search batches" aria-label="Search batches" className={searchCls} />
            {shownBatches.length > 0 && (
              <button type="button" onClick={toggleAllBatches} aria-pressed={allBatchesShownPicked} className={toggleBtn(allBatchesShownPicked)}>
                {allBatchesShownPicked ? "Deselect" : "Select"} all {shownBatches.length} batches
              </button>
            )}
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} /> Group by school
            </label>
          </div>
          {shownBatches.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400">{batches.length ? "No batch matches." : "None available."}</p>
          ) : grouped ? (
            <div className="flex max-h-72 flex-col gap-1 overflow-auto">
              {groups.map(([key, list]) => {
                const label = key === LOOSE ? "Across schools" : schoolName.get(key) ?? "School";
                const n = list.filter(batchChecked).length;
                const isCollapsed = !expanded.has(key) && !bq.trim();
                return (
                  <div key={key} className="rounded-md border border-gray-100">
                    <div className="flex items-center gap-1 bg-gray-50/70 px-2 py-1.5 text-sm">
                      <button type="button" onClick={() => toggleExpanded(key)} aria-expanded={!isCollapsed}
                        aria-label={`${isCollapsed ? "Show" : "Hide"} batches of ${label}`}
                        className="rounded p-0.5 text-gray-500 hover:bg-gray-100">
                        <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (isCollapsed ? "-rotate-90" : "")} aria-hidden="true" />
                      </button>
                      <label className="flex min-w-0 flex-1 items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`All batches of ${label}`}
                          checked={n === list.length}
                          ref={(el) => { if (el) el.indeterminate = n > 0 && n < list.length; }}
                          onChange={() => setBatches(list, n !== list.length)}
                        />
                        <span className="truncate font-medium text-gray-800">{label}</span>
                        <span className="text-xs text-gray-400">{n ? `${n}/${list.length}` : list.length}</span>
                      </label>
                    </div>
                    {!isCollapsed && (
                      <div className="grid gap-0.5 px-2 py-1 pl-8 sm:grid-cols-2">
                        {list.map((b) => (
                          <label key={b.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                            <input type="checkbox" aria-label={b.name} checked={batchChecked(b)} onChange={() => toggleBatch(b)} />
                            <span className="text-gray-900">{b.name}</span>
                            <span className="text-xs text-gray-400">{b.memberCount} students</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid max-h-52 gap-1 overflow-auto sm:grid-cols-2">
              {shownBatches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input type="checkbox" aria-label={b.name} checked={batchChecked(b)} onChange={() => toggleBatch(b)} />
                  <span className="text-gray-900">{b.name}</span>
                  <span className="text-xs text-gray-400">
                    {isLoose(b) ? "across schools" : schoolName.get(b.schoolId as string)} · {b.memberCount} students
                  </span>
                </label>
              ))}
            </div>
          )}
          </>)}
        </fieldset>
      )}
    </div>
  );
}
