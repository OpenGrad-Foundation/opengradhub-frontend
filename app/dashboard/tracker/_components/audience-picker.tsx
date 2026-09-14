"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTrackerAssignable } from "@/lib/queries/tracker";
import type { TrackerAssignable, TrackerTargetType } from "@/lib/tracker-api";
import { IN_CHARGE_LOWER, IN_CHARGE_LOWER_PLURAL, ROLE_LABELS, ZONE, ZONE_LOWER } from "@/lib/labels";

function prettyState(s: string | null): string {
  if (!s) return "";
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

const prettyRole = (r?: string | null) => (r ? ROLE_LABELS[r] ?? prettyState(r) : "");

/** Audience filters over the caller's assignable targets, plus a checkbox list +
 *  Select-all. Reused by the scratch builder and the "use a template" flow. Parent
 *  owns the selected set.
 *
 *  Programme sits OUTSIDE the State → Zone → School cascade and ahead of it. It is
 *  the broadest real scope now that it reads the `programmes` entity rather than the
 *  legacy `users.programme` text, so it narrows the geographic options rather than
 *  being narrowed by them — picking a programme should shorten the state list, not
 *  leave it offering states the programme does not run in. */
export function AudiencePicker({
  targetType,
  canAuthor,
  selected,
  onChange,
  batchId,
}: {
  targetType: TrackerTargetType;
  canAuthor: boolean;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  batchId?: string;
}) {
  const assignable = useTrackerAssignable(targetType, canAuthor, batchId);
  const targetWord = targetType === "school" ? "schools" : targetType === "student" ? "students" : "staff";

  const [stateFilter, setStateFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [programmeFilter, setProgrammeFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const uniq = (vals: (string | null | undefined)[]) => Array.from(new Set(vals.filter(Boolean) as string[])).sort();
  const all = useMemo(() => assignable.data ?? [], [assignable.data]);
  // A target can sit in several programmes (staff seats, school hosting), so this is
  // membership, not equality. Students carry at most one, in the same array shape.
  const byProgramme = (t: TrackerAssignable) =>
    !programmeFilter || t.programmes.some((p) => p.id === programmeFilter);
  const byState = (t: TrackerAssignable) => !stateFilter || t.state === stateFilter;
  const byDistrict = (t: TrackerAssignable) => !districtFilter || t.district === districtFilter;
  const bySchool = (t: TrackerAssignable) => !schoolFilter || t.school_id === schoolFilter;
  const byRole = (t: TrackerAssignable) => !roleFilter || t.role === roleFilter;

  // Programme's own options are computed over every target, unfiltered: it is the
  // outermost filter, so nothing downstream may remove a programme from its list.
  const programmeOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of all) for (const p of t.programmes) m.set(p.id, p.name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [all]);
  const inProgramme = useMemo(() => all.filter(byProgramme), [all, programmeFilter]);

  const stateOpts = useMemo(() => uniq(inProgramme.map((t) => t.state)), [inProgramme]);
  const districtOpts = useMemo(() => uniq(inProgramme.filter(byState).map((t) => t.district)), [inProgramme, stateFilter]);
  // Role filter only appears for a staff (user-doer) target that actually mixes roles — i.e. a
  // PM/Admin seeing ZMs alongside fellows. A ZM's list is fellows-only, so it stays hidden.
  const roleOpts = useMemo(() => uniq(all.map((t) => t.role)), [all]);
  const schoolOpts = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of inProgramme.filter((t) => byState(t) && byDistrict(t))) if (t.school_id) m.set(t.school_id, t.school_name ?? t.school_id);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [inProgramme, stateFilter, districtFilter]);
  const visibleTargets = useMemo(
    () => inProgramme.filter((t) => byState(t) && byDistrict(t) && bySchool(t) && byRole(t)),
    [inProgramme, stateFilter, districtFilter, schoolFilter, roleFilter],
  );

  // A school / student task is picked by WHO fills it in, not by the entry itself: the
  // author ticks in-charges, and each tick stands for every visible school / student that
  // in-charge owns. The parent still receives target ids, so assignment is unchanged. An
  // entry with no in-charge has no doer and cannot be picked.
  const byDoer = targetType !== "fellow";
  const doers = useMemo(() => {
    if (!byDoer) return [];
    const m = new Map<string, { id: string; name: string; ids: string[] }>();
    for (const t of visibleTargets) {
      if (!t.doer_id) continue;
      const d = m.get(t.doer_id) ?? { id: t.doer_id, name: t.doer_name ?? "Unnamed", ids: [] };
      d.ids.push(t.id);
      m.set(t.doer_id, d);
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [byDoer, visibleTargets]);
  const unowned = byDoer ? visibleTargets.filter((t) => !t.doer_id).length : 0;
  const pickable = byDoer ? doers.flatMap((d) => d.ids) : visibleTargets.map((t) => t.id);
  const toggleDoer = (ids: string[]) => {
    const next = new Set(selected);
    if (ids.every((id) => next.has(id))) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    onChange(next);
  };
  // Counted over the WHOLE audience, not the filtered view: a pick hidden by a filter is
  // still assigned on submit, so the footer must still count its in-charge.
  const pickedDoers = byDoer
    ? new Set(all.filter((t) => t.doer_id && selected.has(t.id)).map((t) => t.doer_id)).size
    : 0;
  const hiddenPicks = Array.from(selected).filter((id) => !visibleTargets.some((t) => t.id === id)).length;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  // Narrowing the programme can strip the downstream selections of their meaning —
  // a state the new programme does not run in would filter everything to nothing
  // while still reading as an active choice. Clear them, as State already does.
  const onProgramme = (v: string) => { setProgrammeFilter(v); setStateFilter(""); setDistrictFilter(""); setSchoolFilter(""); };
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
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {programmeOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">Programme
            <select value={programmeFilter} onChange={(e) => onProgramme(e.target.value)} className={filterClass}>
              <option value="">All programmes</option>
              {programmeOpts.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
          </label>
        )}
        {roleOpts.length > 1 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">Role
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterClass}>
              <option value="">All roles</option>
              {roleOpts.map((r) => <option key={r} value={r}>{prettyRole(r)}</option>)}
            </select>
          </label>
        )}
        {stateOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">State
            <select value={stateFilter} onChange={(e) => onState(e.target.value)} className={filterClass}>
              <option value="">All states</option>
              {stateOpts.map((s) => <option key={s} value={s}>{prettyState(s)}</option>)}
            </select>
          </label>
        )}
        {districtOpts.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">{ZONE}
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
      </div>

      {assignable.isLoading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-600" aria-hidden="true" /></div>
      ) : pickable.length === 0 ? (
        <p className="py-4 text-sm text-gray-500">
          {byDoer
            ? `No ${IN_CHARGE_LOWER_PLURAL} own ${targetWord} in your scope for this filter.`
            : `No ${targetWord} in your scope for this filter.`}
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onChange(new Set([...selected, ...pickable]))} className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100">
              Select all {byDoer ? doers.length : visibleTargets.length}
            </button>
            {/* One-click "everyone in this role" — the common case for a staff task is "all
                ZMs" or "all in-charges", which the Role filter + Select all needs three
                clicks for. Adds to the selection, ignores the other filters on purpose. */}
            {roleOpts.length > 1 && roleOpts.map((r) => {
              const ids = all.filter((t) => t.role === r).map((t) => t.id);
              const label = prettyRole(r);
              return (
                <button key={r} type="button" onClick={() => onChange(new Set([...selected, ...ids]))}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  All {label.toLowerCase().endsWith("s") ? label : `${label}s`} ({ids.length})
                </button>
              );
            })}
          </div>
          {byDoer ? (
          <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
            {doers.map((d) => {
              const n = d.ids.filter((id) => selected.has(id)).length;
              return (
                <label key={d.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={n === d.ids.length}
                    ref={(el) => { if (el) el.indeterminate = n > 0 && n < d.ids.length; }}
                    onChange={() => toggleDoer(d.ids)}
                  />
                  <span className="text-gray-900">{d.name}</span>
                  <span className="text-xs text-gray-400">{d.ids.length} {plural(d.ids.length, targetWord.replace(/s$/, ""), targetWord)}</span>
                </label>
              );
            })}
          </div>
          ) : (
          <div className="grid max-h-56 gap-1 overflow-auto sm:grid-cols-2">
            {visibleTargets.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="text-gray-900">{t.name}</span>
                {roleOpts.length > 1 && t.role && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">{prettyRole(t.role)}</span>
                )}
                {t.school_name && <span className="text-xs text-gray-400">{t.school_name}</span>}
                {!t.school_name && t.state && <span className="text-xs text-gray-400">{prettyState(t.state)}</span>}
              </label>
            ))}
          </div>
          )}
        </>
      )}
      {byDoer && unowned > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {unowned} {plural(unowned, targetWord.replace(/s$/, ""), targetWord)} with no {IN_CHARGE_LOWER} cannot be assigned.
        </p>
      )}
      {/* Clear lives outside the list so a filter that empties the view cannot strand
          picks the author can no longer see. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>
          {byDoer
            ? `${pickedDoers} ${plural(pickedDoers, IN_CHARGE_LOWER, IN_CHARGE_LOWER_PLURAL)} · ${selected.size} ${plural(selected.size, targetWord.replace(/s$/, ""), targetWord)} selected.`
            : `${selected.size} selected.`}
          {hiddenPicks > 0 && ` ${hiddenPicks} hidden by the filters above.`}
        </span>
        {selected.size > 0 && (
          <button type="button" onClick={() => onChange(new Set())} className="font-medium text-gray-500 hover:text-gray-800">Clear</button>
        )}
      </div>
    </div>
  );
}
