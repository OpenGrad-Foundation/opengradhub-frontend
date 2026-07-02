"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTrackerAssignable } from "@/lib/queries/tracker";
import type { TrackerAssignable, TrackerTargetType } from "@/lib/tracker-api";

function prettyState(s: string | null): string {
  if (!s) return "";
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

/** Cascading audience filters (State → District → School → Programme) over the caller's
 *  assignable targets, plus a checkbox list + Select-all. Reused by the scratch builder
 *  and the "use a template" flow. Parent owns the selected set. */
export function AudiencePicker({
  targetType,
  canAuthor,
  selected,
  onChange,
}: {
  targetType: TrackerTargetType;
  canAuthor: boolean;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const assignable = useTrackerAssignable(targetType, canAuthor);
  const targetWord = targetType === "school" ? "schools" : targetType === "student" ? "students" : "fellows";

  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");

  const uniq = (vals: (string | null | undefined)[]) => Array.from(new Set(vals.filter(Boolean) as string[])).sort();
  const all = useMemo(() => assignable.data ?? [], [assignable.data]);
  const byState = (t: TrackerAssignable) => !stateFilter || t.state === stateFilter;
  const byDistrict = (t: TrackerAssignable) => !districtFilter || t.district === districtFilter;
  const bySchool = (t: TrackerAssignable) => !schoolFilter || t.school_id === schoolFilter;
  const byProgramme = (t: TrackerAssignable) => !programmeFilter || t.programme === programmeFilter;

  const stateOpts = useMemo(() => uniq(all.map((t) => t.state)), [all]);
  const districtOpts = useMemo(() => uniq(all.filter(byState).map((t) => t.district)), [all, stateFilter]);
  const schoolOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of all.filter((t) => byState(t) && byDistrict(t))) if (t.school_id) m.set(t.school_id, t.school_name ?? t.school_id);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, stateFilter, districtFilter]);
  const programmeOpts = useMemo(
    () => uniq(all.filter((t) => byState(t) && byDistrict(t) && bySchool(t)).map((t) => t.programme)),
    [all, stateFilter, districtFilter, schoolFilter],
  );
  const visibleTargets = useMemo(
    () => all.filter((t) => byState(t) && byDistrict(t) && bySchool(t) && byProgramme(t)),
    [all, stateFilter, districtFilter, schoolFilter, programmeFilter],
  );

  const onState = (v: string) => { setStateFilter(v); setDistrictFilter(""); setSchoolFilter(""); };
  const onDistrict = (v: string) => { setDistrictFilter(v); setSchoolFilter(""); };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };

  const filterClass = "h-9 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">Narrow by area, then pick all matching {targetWord} at once.</p>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stateOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">State
            <select value={stateFilter} onChange={(e) => onState(e.target.value)} className={filterClass}>
              <option value="">All states</option>
              {stateOpts.map((s) => <option key={s} value={s}>{prettyState(s)}</option>)}
            </select>
          </label>
        )}
        {districtOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">District
            <select value={districtFilter} onChange={(e) => onDistrict(e.target.value)} className={filterClass}>
              <option value="">All districts</option>
              {districtOpts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        )}
        {schoolOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">School
            <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className={filterClass}>
              <option value="">All schools</option>
              {schoolOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {programmeOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">Programme
            <select value={programmeFilter} onChange={(e) => setProgrammeFilter(e.target.value)} className={filterClass}>
              <option value="">All programmes</option>
              {programmeOpts.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </select>
          </label>
        )}
      </div>

      {assignable.isLoading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
      ) : visibleTargets.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">No {targetWord} in your scope for this filter.</p>
      ) : (
        <>
          <div className="mb-2 flex items-center gap-3">
            <button type="button" onClick={() => onChange(new Set([...selected, ...visibleTargets.map((t) => t.id)]))} className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
              Select all {visibleTargets.length}
            </button>
            {selected.size > 0 && (
              <button type="button" onClick={() => onChange(new Set())} className="text-xs font-medium text-gray-500 hover:text-gray-800">Clear</button>
            )}
          </div>
          <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
            {visibleTargets.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="text-gray-900">{t.name}</span>
                {t.school_name && <span className="text-xs text-gray-400">{t.school_name}</span>}
                {!t.school_name && t.state && <span className="text-xs text-gray-400">{prettyState(t.state)}</span>}
              </label>
            ))}
          </div>
        </>
      )}
      <p className="mt-2 text-xs text-gray-500">{selected.size} selected.</p>
    </div>
  );
}
